import type { FeatRecord } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { backgroundFeatOffers, withFeatBlock } from "./backgroundFeats.ts";

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
