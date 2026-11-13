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
  it("offers only the options that change something under the character's edition", () => {
    const card = renderCard(identityRecord());

    expect(
      card.getAllByRole("group").map((group) => group.querySelector("legend")?.textContent),
    ).toEqual([
      "Encumbrance",
      "Replace a duplicate skill",
      "Replace a duplicate tool",
      "Equipping without proficiency",
      "Massive damage",
      "Material components",
    ]);
  });

  it("saves the waiver of material components", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(classic({}))));
    const group = within(
      renderCard(classic({})).getByRole("group", { name: "Material components" }),
    );
    expect(group.getByRole("radio", { name: /Components as printed/ })).toBeChecked();

    fireEvent.click(group.getByRole("radio", { name: "Waive components" }));

    await waitFor(() => expect(written(fetchMock)).toEqual({ waiveMaterialComponents: true }));
  });

  it("offers the hit dice option to a classic character", () => {
    const hitDice = within(
      renderCard(classic({})).getByRole("group", { name: "Hit dice on a long rest" }),
    );

    expect(hitDice.getByRole("radio", { name: /Half return/ })).toBeChecked();
  });

  it("turns off the every-hit-die default a classic character is created with", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(classic({}))));
    const hitDice = within(
      renderCard(classic({ everyHitDieOnLongRest: true })).getByRole("group", {
        name: "Hit dice on a long rest",
      }),
    );
    expect(hitDice.getByRole("radio", { name: /All return/ })).toBeChecked();

    fireEvent.click(hitDice.getByRole("radio", { name: /Half return/ }));

    await waitFor(() => expect(written(fetchMock)).toEqual({ everyHitDieOnLongRest: false }));
  });

  it("names both outcomes, marks the printed one, and describes the one in effect", () => {
    const card = renderCard(identityRecord());
    const encumbrance = within(card.getByRole("group", { name: "Encumbrance" }));

    expect(encumbrance.getByRole("radio", { name: /Weight only caps carrying/ })).toBeChecked();
    expect(
      encumbrance.getByRole("radio", { name: /Weight only caps carrying/ }),
    ).toHaveAccessibleName("Weight only caps carrying As printed");
    expect(encumbrance.getByRole("radio", { name: "Heavy loads slow you" })).not.toBeChecked();
    expect(card.getByRole("group", { name: "Encumbrance" })).toHaveAccessibleDescription(
      /never costs speed or gives disadvantage/,
    );
  });

  it("reads an option the definition never set as the rule as printed", () => {
    const card = renderCard(classic({ feats: true }));

    expect(card.getByRole("radio", { name: "Feat or scores" })).toBeChecked();
    expect(card.getByRole("radio", { name: /Increases as the race prints/ })).toBeChecked();
    expect(card.getByRole("radio", { name: /Printed features only/ })).toBeChecked();
  });

  it("turns a 2014 character's feats off, keeping the other options", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(classic({}))));
    const card = renderCard(classic({ feats: true, encumbrance: true }));

    fireEvent.click(card.getByRole("radio", { name: /Scores only/ }));

    await waitFor(() => expect(written(fetchMock)).toEqual({ feats: false, encumbrance: true }));
  });

  it("shows a choice while its write is in flight, and the stored one after a failure", async () => {
    let fail: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (fail = resolve))),
    );
    const card = renderCard(identityRecord());
    const house = card.getByRole("radio", { name: "Heavy loads slow you" });

    fireEvent.click(house);
    expect(house).toBeChecked();
    expect(card.getByRole("group", { name: "Encumbrance" })).toHaveAccessibleDescription(
      /costs 10 feet of speed/,
    );

    await waitFor(() => expect(fail).toBeDefined());
    fail?.(new Response(JSON.stringify({ error: "disk full" }), { status: 500 }));
    await waitFor(() => expect(house).not.toBeChecked());
  });
});
