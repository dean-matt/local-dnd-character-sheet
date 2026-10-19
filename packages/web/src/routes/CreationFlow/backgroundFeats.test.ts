import type { FeatRecord } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { backgroundFeatOffers } from "./backgroundFeats.ts";

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
