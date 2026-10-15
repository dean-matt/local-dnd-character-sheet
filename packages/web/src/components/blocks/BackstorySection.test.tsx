import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { characterRecord } from "../../test/records.ts";
import { stubFetch } from "../../test/stubFetch.ts";
import { BackstorySection } from "./BackstorySection.tsx";

function renderSeeded(backstory: Record<string, string>) {
  const record = characterRecord("1", "Vex");
  record.definition.backstory = backstory;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <BackstorySection character={record} />
    </QueryClientProvider>,
  );
}

/** The body of the one character write `fetchMock` saw. */
async function written(fetchMock: ReturnType<typeof stubFetch>) {
  const puts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  await waitFor(() => expect(puts()).toHaveLength(1));
  return JSON.parse(String(puts()[0]?.[1]?.body));
}

const box = (label: string) => screen.getByRole("textbox", { name: label });

afterEach(() => vi.unstubAllGlobals());

describe("BackstorySection", () => {
  it("shows the four personality boxes and the backstory, each a text area", () => {
    renderSeeded({ ideals: "Freedom.", story: "Born in Neverwinter." });

    for (const label of ["Personality Traits", "Ideals", "Bonds", "Flaws", "Backstory"]) {
      expect(box(label).tagName).toBe("TEXTAREA");
    }
    expect(box("Ideals")).toHaveValue("Freedom.");
    expect(box("Backstory")).toHaveValue("Born in Neverwinter.");
    expect(box("Bonds")).toHaveValue("");
  });

  it("saves a box as typed, line breaks kept, beside the others", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify(characterRecord("1", "Vex")), { status: 200 }),
    );
    renderSeeded({ ideals: "Freedom." });

    fireEvent.change(box("Backstory"), {
      target: { value: "Born in Neverwinter.\n\nLeft at 12." },
    });
    fireEvent.blur(box("Backstory"));

    expect((await written(fetchMock)).backstory).toEqual({
      ideals: "Freedom.",
      story: "Born in Neverwinter.\n\nLeft at 12.",
    });
  });

  it("clears a box of whitespace to unset rather than storing it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify(characterRecord("1", "Vex")), { status: 200 }),
    );
    renderSeeded({ ideals: "Freedom.", flaws: "Greedy." });

    fireEvent.change(box("Flaws"), { target: { value: " \n " } });
    fireEvent.blur(box("Flaws"));

    expect((await written(fetchMock)).backstory).toEqual({ ideals: "Freedom." });
  });
});
