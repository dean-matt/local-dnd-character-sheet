import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishItems } from "./contentFixture.ts";
import { getItem, listItems } from "./items.ts";

const LONGSWORD = {
  name: "Longsword",
  source: "PHB",
  edition: "classic",
  kind: "baseitem",
  type: "M",
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Longsword", source: "PHB" }),
};

const DEMON_ARMOR = {
  name: "Demon Armor",
  source: "DMG",
  edition: "classic",
  kind: "item",
  type: "HA",
  rarity: "very rare",
  requires_attunement: 1 as const,
  json: JSON.stringify({ name: "Demon Armor", source: "DMG" }),
};

const BAG_OF_TRICKS = {
  name: "Bag of Tricks",
  source: "DMG",
  edition: "classic",
  kind: "itemGroup",
  type: null,
  rarity: "uncommon",
  requires_attunement: 0 as const,
  json: JSON.stringify({ name: "Bag of Tricks", source: "DMG" }),
};

describe("content item queries", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-items-"));
    publishItems(dataDir, [LONGSWORD, DEMON_ARMOR, BAG_OF_TRICKS]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists only item and baseitem kinds, filtered to one edition", () => {
    expect(listItems(dataDir, "classic")).toEqual([DEMON_ARMOR, LONGSWORD]);
  });

  it("reads one item by name and source, whatever its kind", () => {
    expect(getItem(dataDir, "Longsword", "PHB")).toEqual(LONGSWORD);
    expect(getItem(dataDir, "Bag of Tricks", "DMG")).toEqual(BAG_OF_TRICKS);
    expect(getItem(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});
