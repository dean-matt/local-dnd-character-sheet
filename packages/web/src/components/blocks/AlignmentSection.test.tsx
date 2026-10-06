import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { characterRecord, identityRecord } from "../../test/records.ts";
import { stubFetch } from "../../test/stubFetch.ts";
import { AlignmentSection } from "./AlignmentSection.tsx";

function renderSeeded(character = identityRecord()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <AlignmentSection character={character} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("AlignmentSection", () => {
  it("shows the alignment", () => {
    renderSeeded();
    expect(screen.getByRole("combobox", { name: "Alignment" })).toHaveValue("Chaotic Good");
  });

  it("says none is set on a character without one", () => {
    renderSeeded(characterRecord("1", "Vex"));
    const field = screen.getByRole("combobox", { name: "Alignment" });
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("placeholder", "No alignment set");
  });

  it("suggests the nine alignments and saves one it does not list", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(identityRecord())));
    renderSeeded();

    const field = screen.getByRole("combobox", { name: "Alignment" });
    const options = document.getElementById(String(field.getAttribute("list")))?.children;
    expect(options).toHaveLength(9);

    fireEvent.change(field, { target: { value: "Clockwork" } });
    fireEvent.blur(field);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).alignment).toBe("Clockwork");
  });

  it("drops the alignment from the definition when the field is cleared", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(characterRecord("1", "Vex"))));
    renderSeeded();

    const field = screen.getByRole("combobox", { name: "Alignment" });
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty("alignment");
  });
});
