import type { FeatRecord, HomebrewFeatRecord } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import {
  backgroundFeatOffers,
  withBackgroundFeat,
  withBackgroundPick,
  withFeatBlock,
} from "./backgroundFeats.ts";

const feat = (name: string, source: string, category?: string): FeatRecord => ({
  name,
  source,
  edition: "classic",
  json: { name, source, ...(category && { category }) },
});
const CATALOG = [
  feat("Alert", "PHB"),
  feat("Skilled", "PHB"),
  feat("Tough", "PHB"),
  feat("Survivor", "RHW"),
  feat("Watchers", "RHW", "DG"),
  feat("Living Shadow", "RHW", "DG"),
];
const INITIATE: FeatRecord = {
  ...feat("Magic Initiate", "XPHB"),
  json: {
    name: "Magic Initiate",
    source: "XPHB",
    additionalSpells: [
      { name: "Cleric Spells" },
      { name: "Druid Spells" },
      { name: "Wizard Spells" },
    ],
  },
};
const names = (json: Record<string, unknown>) =>
  backgroundFeatOffers(json, CATALOG).options.map((row) => row.name);

describe("backgroundFeatOffers", () => {
  it("offers each alternative Ruined lists and leaves the pick to the character", () => {
    const ruined = {
      feats: [{ "alert|phb": true }, { "skilled|phb": true }, { "tough|phb": true }],
    };
    expect(names(ruined)).toEqual(["Alert", "Skilled", "Tough"]);
    expect(backgroundFeatOffers(ruined, CATALOG).fixed).toBe(false);
  });

  it("offers a fixed feat as fixed, and nothing for a name no feat answers", () => {
    expect(backgroundFeatOffers({ feats: [{ "alert|phb": true }] }, CATALOG)).toEqual({
      options: [expect.objectContaining({ name: "Alert" })],
      fixed: true,
    });
    expect(backgroundFeatOffers({ feats: [{ "nothing|phb": true }] }, CATALOG).options).toEqual([]);
    expect(backgroundFeatOffers({}, CATALOG)).toEqual({ options: [], fixed: false });
  });

  it("offers every feat of a category beside a named one, as the Haunted One does", () => {
    const haunted = {
      feats: [{ "survivor|rhw": true }, { anyFromCategory: { category: ["DG"] } }],
    };
    expect(names(haunted)).toEqual(["Survivor", "Watchers", "Living Shadow"]);
    expect(backgroundFeatOffers(haunted, CATALOG).fixed).toBe(false);
  });
});

describe("backgroundFeatOffers over homebrew feats", () => {
  const homebrew = (id: string, name: string, category?: string): HomebrewFeatRecord => ({
    id,
    name,
    edition: "one",
    json: { name, source: "HB", ...(category && { category }) },
    createdAt: "2026-10-28T00:00:00.000Z",
  });
  const origin = [feat("Alert", "XPHB", "O"), feat("Skilled", "XPHB", "O")];

  it("offers a homebrew feat of the category beside the catalog's", () => {
    const offers = backgroundFeatOffers({ feats: [{ anyFromCategory: { category: ["O"] } }] }, [
      ...origin,
      homebrew("hf-1", "Quick Study", "O"),
      homebrew("hf-2", "Brawler", "G"),
    ]);
    expect(offers.options.map((row) => row.name)).toEqual(["Alert", "Skilled", "Quick Study"]);
  });

  it("answers a named feat from the catalog alone", () => {
    const offers = backgroundFeatOffers({ feats: [{ "alert|xphb": true }] }, [
      ...origin,
      homebrew("hf-3", "Alert", "O"),
    ]);
    expect(offers.options).toEqual([expect.objectContaining({ name: "Alert", source: "XPHB" })]);
  });

  it("stores a homebrew pick by id, granted by the background, and drops it with the background", () => {
    const sage = { name: "Sage", source: "XPHB" };
    const study = homebrew("hf-1", "Quick Study", "O");
    const picked = withBackgroundPick([], sage, study);
    expect(picked).toEqual([
      { ref: { homebrewId: "hf-1" }, grantedBy: { kind: "background", ref: sage } },
    ]);
    const offers = { options: [study], fixed: false };
    expect(withBackgroundFeat(picked, sage, offers)).toBe(picked);
    expect(withBackgroundFeat(picked, { name: "Hermit", source: "XPHB" }, offers)).toEqual([]);
  });
});

describe("a background naming a feat variant", () => {
  const offers = (key: string) =>
    backgroundFeatOffers({ feats: [{ [key]: true }] }, [...CATALOG, INITIATE]);

  it("grants the feat the catalog holds once, with the named spell list", () => {
    expect(offers("magic initiate; cleric|xphb")).toEqual({
      options: [
        expect.objectContaining({ name: "Magic Initiate", block: 0, list: "Cleric Spells" }),
      ],
      fixed: true,
    });
    expect(offers("magic initiate; wizard|xphb").options[0]?.block).toBe(2);
  });

  it("offers nothing for a variant in another source or with no spell list", () => {
    expect(offers("magic initiate; cleric|phb").options).toEqual([]);
    expect(offers("magic initiate; bard|xphb").options[0]?.block).toBeUndefined();
  });
});

describe("withFeatBlock", () => {
  const feat = { name: "Magic Initiate", source: "XPHB" };
  const grantor = { kind: "feat" as const, ref: feat };

  it("replaces the feat's list and returns the same array where it already is chosen", () => {
    const cleric = withFeatBlock([], feat, 0);
    expect(cleric).toEqual([{ grantor, block: 0 }]);
    expect(withFeatBlock(cleric, feat, 0)).toBe(cleric);
    expect(withFeatBlock(cleric, feat, 2)).toEqual([{ grantor, block: 2 }]);
  });
});
