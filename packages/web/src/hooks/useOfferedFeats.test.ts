import type { FeatRecord, HomebrewFeatRecord } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { offeredFeats } from "./useOfferedFeats.ts";

const ALERT: FeatRecord = {
  name: "Alert",
  source: "XPHB",
  edition: "one",
  json: { name: "Alert", source: "XPHB" },
};
const homebrew = (id: string, edition: "classic" | "one"): HomebrewFeatRecord => ({
  id,
  name: `Feat ${id}`,
  edition,
  json: { name: `Feat ${id}`, source: "HB" },
  createdAt: "2026-10-28T00:00:00.000Z",
});
const HOMEBREW = [homebrew("1", "one"), homebrew("2", "one"), homebrew("3", "classic")];
const names = (feats: ReturnType<typeof offeredFeats>) => feats?.map(({ name }) => name);

describe("offeredFeats", () => {
  it("offers the catalog's feats and the homebrew feats of the edition", () => {
    expect(names(offeredFeats([ALERT], HOMEBREW, "one", true, []))).toEqual([
      "Alert",
      "Feat 1",
      "Feat 2",
    ]);
  });

  it("keeps only the held homebrew feat while the Homebrew source is off", () => {
    expect(names(offeredFeats([ALERT], HOMEBREW, "one", false, [{ homebrewId: "2" }]))).toEqual([
      "Alert",
      "Feat 2",
    ]);
  });

  it("offers nothing until both lists load", () => {
    expect(offeredFeats(undefined, HOMEBREW, "one", true, [])).toBeUndefined();
    expect(offeredFeats([ALERT], undefined, "one", true, [])).toBeUndefined();
  });
});
