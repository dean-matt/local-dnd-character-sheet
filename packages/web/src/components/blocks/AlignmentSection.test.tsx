import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { characterRecord, identityRecord } from "../../test/records.ts";
import { stubFetch } from "../../test/stubFetch.ts";
import { AlignmentSection } from "./AlignmentSection.tsx";

/** Reads the character from the cache, as the sheet does, so a write's response reaches it. */
function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return <AlignmentSection character={data} />;
}

function renderSeeded(character = identityRecord()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
    </QueryClientProvider>,
  );
  return client;
}

const field = () => screen.getByRole("combobox", { name: "Alignment" });
const open = () => {
  fireEvent.click(field());
  return screen.getByRole("listbox", { name: "Alignment" });
};
const sentBody = (fetchMock: ReturnType<typeof stubFetch>) =>
  JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));

afterEach(() => vi.unstubAllGlobals());

describe("AlignmentSection", () => {
  it("shows the alignment on the button", () => {
    renderSeeded();
    expect(field()).toHaveTextContent("Chaotic Good");
  });

  it("offers None and the nine alignments, the stored one checked", () => {
    renderSeeded();
    const options = within(open()).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "None",
      "Lawful Good",
      "Neutral Good",
      "Chaotic Good",
      "Lawful Neutral",
      "Neutral",
      "Chaotic Neutral",
      "Lawful Evil",
      "Neutral Evil",
      "Chaotic Evil",
    ]);
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Chaotic Good");
  });

  it("shows None on a character without one", () => {
    renderSeeded(characterRecord("1", "Vex"));
    expect(field()).toHaveTextContent("None");
    open();
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("None");
  });

  it("keeps a stored alignment outside the nine as a chosen option of its own", () => {
    const record = identityRecord();
    renderSeeded({ ...record, definition: { ...record.definition, alignment: "Clockwork" } });
    expect(field()).toHaveTextContent("Clockwork");
    const options = within(open()).getAllByRole("option");
    expect(options).toHaveLength(11);
    expect(options.at(-1)).toHaveTextContent("Clockwork");
    expect(options.at(-1)).toHaveAttribute("aria-selected", "true");
  });

  it("saves a picked alignment at once and says so", async () => {
    const record = identityRecord();
    const fetchMock = stubFetch(
      new Response(
        JSON.stringify({ ...record, definition: { ...record.definition, alignment: "Neutral" } }),
      ),
    );
    renderSeeded(record);

    fireEvent.click(within(open()).getByRole("option", { name: "Neutral" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock).alignment).toBe("Neutral");
  });

  it("drops the alignment from the definition on None", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(characterRecord("1", "Vex"))));
    renderSeeded();

    fireEvent.click(within(open()).getByRole("option", { name: "None" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock)).not.toHaveProperty("alignment");
  });

  it("writes nothing when the chosen alignment is picked again", () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(identityRecord())));
    renderSeeded();
    fireEvent.click(within(open()).getByRole("option", { name: "Chaotic Good" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the stored value on a failed save and offers Retry", async () => {
    const record = identityRecord();
    const saved = { ...record, definition: { ...record.definition, alignment: "Lawful Evil" } };
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "disk full" }), { status: 500 }),
    );
    renderSeeded(record);

    fireEvent.click(within(open()).getByRole("option", { name: "Lawful Evil" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save Lawful Evil: disk full"),
    );
    expect(field()).toHaveTextContent("Chaotic Good");
    expect(field()).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(saved)));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(fetchMock).alignment).toBe("Lawful Evil");
  });

  it("shows a value set from outside, such as by undo, and drops Saved", async () => {
    const record = identityRecord();
    const saved = { ...record, definition: { ...record.definition, alignment: "Neutral" } };
    stubFetch(new Response(JSON.stringify(saved)));
    const client = renderSeeded(record);

    fireEvent.click(within(open()).getByRole("option", { name: "Neutral" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));

    client.setQueryData(characterKey(record.id), record);
    await waitFor(() => expect(field()).toHaveTextContent("Chaotic Good"));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
