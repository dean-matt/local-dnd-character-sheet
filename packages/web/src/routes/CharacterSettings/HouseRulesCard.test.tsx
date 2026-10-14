import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { identityRecord } from "../../test/records.ts";
import { stubFetch } from "../../test/stubFetch.ts";
import { HouseRulesCard } from "./HouseRulesCard.tsx";

const classic = (houseRules: CharacterRecord["definition"]["houseRules"]): CharacterRecord => {
  const record = identityRecord();
  return {
    ...record,
    edition: "classic",
    definition: { ...record.definition, edition: "classic", houseRules },
  };
};

function renderCard(record: CharacterRecord) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <HouseRulesCard character={record} />
    </QueryClientProvider>,
  );
  return within(screen.getByRole("region", { name: "House rules" }));
}

const written = (fetchMock: ReturnType<typeof stubFetch>) => {
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
  return put && JSON.parse(String(put[1]?.body)).houseRules;
};

afterEach(() => vi.unstubAllGlobals());

describe("HouseRulesCard", () => {
  it("offers only the options that change something under the character's edition, each described", () => {
    const card = renderCard(identityRecord());

    expect(card.getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual([
      "Encumbrance",
      "Replace a duplicate skill",
      "Replace a duplicate tool",
    ]);
    expect(
      card.getByRole("checkbox", { name: "Replace a duplicate skill" }),
    ).toHaveAccessibleDescription(/pick any other skill instead/);
    expect(card.getByRole("checkbox", { name: "Encumbrance" })).toHaveAccessibleDescription(
      /disadvantage on Strength, Dexterity and Constitution checks, saves and attack rolls/,
    );
  });

  it("reads an option the definition never set as the rule as printed", () => {
    const card = renderCard(classic({ feats: true }));

    expect(card.getByRole("checkbox", { name: "Feats" })).toBeChecked();
    expect(card.getByRole("checkbox", { name: "Custom origin" })).not.toBeChecked();
    expect(card.getByRole("checkbox", { name: "Optional class features" })).not.toBeChecked();
  });

  it("turns a 2014 character's feats off, keeping the other options", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(classic({}))));
    const card = renderCard(classic({ feats: true, encumbrance: true }));

    fireEvent.click(card.getByRole("checkbox", { name: "Feats" }));

    await waitFor(() => expect(written(fetchMock)).toEqual({ feats: false, encumbrance: true }));
  });

  it("shows a switch's new state while its write is in flight, and the stored one after a failure", async () => {
    let fail: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (fail = resolve))),
    );
    const card = renderCard(identityRecord());
    const box = card.getByRole("checkbox", { name: "Encumbrance" });

    fireEvent.click(box);
    expect(box).toBeChecked();

    await waitFor(() => expect(fail).toBeDefined());
    fail?.(new Response(JSON.stringify({ error: "disk full" }), { status: 500 }));
    await waitFor(() => expect(box).not.toBeChecked());
  });
});
