import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { setDisabledSources } from "../../../lib/disabledSources.ts";
import { characterRecord } from "../../../test/records.ts";
import { stubFetch } from "../../../test/stubFetch.ts";
import { FeatureChoiceField } from "./FeatureChoiceField.tsx";

const TOTEM_SPIRIT = {
  name: "Totem Spirit",
  source: "PHB",
  className: "Barbarian",
  classSource: "PHB",
  subclass: { shortName: "Totem Warrior", source: "PHB" },
  level: 3,
};
const BEAR = { name: "Bear", source: "PHB" };
const ELK = { name: "Elk", source: "SCAG" };
const WOLF = { name: "Wolf", source: "PHB" };
const CHOICE = { feature: TOTEM_SPIRIT, count: 1, options: [BEAR, ELK, WOLF] };

const holding = (options: { name: string; source: string }[]): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    definition: { ...record.definition, featureChoices: [{ feature: TOTEM_SPIRIT, options }] },
  };
};

/** Reads the character from the cache, as the sheet does, so a write's response reaches it. */
function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return data ? <FeatureChoiceField character={data} choice={CHOICE} /> : null;
}

function renderSeeded(character: CharacterRecord) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
    </QueryClientProvider>,
  );
}

const field = () => screen.getByRole("combobox", { name: "Totem Spirit choice" });
const open = () => {
  fireEvent.click(field());
  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);
};

afterEach(() => {
  setDisabledSources([]);
  vi.unstubAllGlobals();
});

describe("FeatureChoiceField", () => {
  it("names the option taken", () => {
    renderSeeded(holding([WOLF]));
    expect(field()).toHaveTextContent("Wolf");
  });

  it("asks for an option where none is taken", () => {
    renderSeeded(characterRecord("1", "Vex"));
    expect(field()).toHaveTextContent("Choose one");
  });

  it("leaves out an option from a source the reader turned off, unless it is the one taken", () => {
    setDisabledSources(["SCAG"]);
    renderSeeded(holding([WOLF]));
    expect(open()).toEqual(["Bear", "Wolf"]);
  });

  it("keeps a taken option from a source the reader turned off", () => {
    setDisabledSources(["SCAG"]);
    renderSeeded(holding([ELK]));
    expect(open()).toEqual(["Bear", "Elk", "Wolf"]);
  });

  it("replaces the option taken under the feature's whole key, and says it saved", async () => {
    const saved = holding([BEAR]);
    const fetchMock = stubFetch(new Response(JSON.stringify(saved)));
    renderSeeded(holding([WOLF]));

    open();
    fireEvent.click(screen.getByRole("option", { name: "Bear" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/characters/1");
    expect(JSON.parse(String(init?.body)).featureChoices).toEqual([
      { feature: TOTEM_SPIRIT, options: [BEAR] },
    ]);
  });
});
