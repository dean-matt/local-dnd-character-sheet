import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getBackground,
  getFeat,
  getItem,
  getRace,
  getSpell,
  getSubrace,
  listBackgrounds,
  listFeats,
  listItems,
  listRaces,
  listSpells,
  listSubraces,
} from "./content.ts";
import {
  publishBackgrounds,
  publishFeats,
  publishItems,
  publishRaces,
  publishSpells,
  publishSubraces,
} from "./contentFixture.ts";

const FIREBALL = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3,
  school: "V",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name: "Fireball", source: "PHB", level: 3, school: "V" }),
};

const GOODBERRY_ONE = {
  name: "Goodberry",
  source: "XPHB",
  edition: "one",
  level: 1,
  school: "C",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ name: "Goodberry", source: "XPHB", level: 1, school: "C" }),
};

describe("content spell queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists spells filtered to one edition, sorted by name then source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-spells-"));
    publishSpells(dataDir, [FIREBALL, GOODBERRY_ONE]);

    expect(listSpells(dataDir, "classic")).toEqual([FIREBALL]);
    expect(listSpells(dataDir, "one")).toEqual([GOODBERRY_ONE]);
  });

  it("reads one spell by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-spells-"));
    publishSpells(dataDir, [FIREBALL]);

    expect(getSpell(dataDir, "Fireball", "PHB")).toEqual(FIREBALL);
    expect(getSpell(dataDir, "Fireball", "XPHB")).toBeUndefined();
    expect(getSpell(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const ELF = {
  name: "Elf",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Elf", source: "PHB" }),
};

const TIEFLING_ONE = {
  name: "Tiefling",
  source: "XPHB",
  edition: "one",
  json: JSON.stringify({ name: "Tiefling", source: "XPHB" }),
};

describe("content race queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists races filtered to one edition, sorted by name then source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-races-"));
    publishRaces(dataDir, [ELF, TIEFLING_ONE]);

    expect(listRaces(dataDir, "classic")).toEqual([ELF]);
    expect(listRaces(dataDir, "one")).toEqual([TIEFLING_ONE]);
  });

  it("reads one race by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-races-"));
    publishRaces(dataDir, [ELF]);

    expect(getRace(dataDir, "Elf", "PHB")).toEqual(ELF);
    expect(getRace(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const HIGH_ELF = {
  name: "High",
  source: "PHB",
  race_name: "Elf",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "High", source: "PHB" }),
};

const WOOD_ELF = {
  name: "Wood",
  source: "PHB",
  race_name: "Elf",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Wood", source: "PHB" }),
};

const HUMAN_BASE = {
  name: "",
  source: "PHB",
  race_name: "Human",
  race_source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Human", source: "PHB" }),
};

describe("content subrace queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists subraces of one race, filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HIGH_ELF, WOOD_ELF, HUMAN_BASE]);

    expect(listSubraces(dataDir, "Elf", "PHB", "classic")).toEqual([HIGH_ELF, WOOD_ELF]);
    expect(listSubraces(dataDir, "Human", "PHB", "classic")).toEqual([HUMAN_BASE]);
  });

  it("reads one subrace by its own key and its race's", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HIGH_ELF]);

    expect(getSubrace(dataDir, "High", "PHB", "Elf", "PHB")).toEqual(HIGH_ELF);
    expect(getSubrace(dataDir, "High", "PHB", "Gnome", "PHB")).toBeUndefined();
  });

  it("allows the empty subrace name a base variant with no subrace of its own carries", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HUMAN_BASE]);

    expect(getSubrace(dataDir, "", "PHB", "Human", "PHB")).toEqual(HUMAN_BASE);
  });
});

const ACOLYTE = {
  name: "Acolyte",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Acolyte", source: "PHB" }),
};

describe("content background queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists backgrounds filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-backgrounds-"));
    publishBackgrounds(dataDir, [ACOLYTE]);

    expect(listBackgrounds(dataDir, "classic")).toEqual([ACOLYTE]);
    expect(listBackgrounds(dataDir, "one")).toEqual([]);
  });

  it("reads one background by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-backgrounds-"));
    publishBackgrounds(dataDir, [ACOLYTE]);

    expect(getBackground(dataDir, "Acolyte", "PHB")).toEqual(ACOLYTE);
    expect(getBackground(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

const ALERT = {
  name: "Alert",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Alert", source: "PHB" }),
};

describe("content feat queries", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists feats filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-feats-"));
    publishFeats(dataDir, [ALERT]);

    expect(listFeats(dataDir, "classic")).toEqual([ALERT]);
    expect(listFeats(dataDir, "one")).toEqual([]);
  });

  it("reads one feat by name and source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-feats-"));
    publishFeats(dataDir, [ALERT]);

    expect(getFeat(dataDir, "Alert", "PHB")).toEqual(ALERT);
    expect(getFeat(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});

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

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists only item and baseitem kinds, filtered to one edition", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-items-"));
    publishItems(dataDir, [LONGSWORD, DEMON_ARMOR, BAG_OF_TRICKS]);

    expect(listItems(dataDir, "classic")).toEqual([DEMON_ARMOR, LONGSWORD]);
  });

  it("reads one item by name and source, whatever its kind", () => {
    dataDir = mkdtempSync(join(tmpdir(), "content-items-"));
    publishItems(dataDir, [LONGSWORD, BAG_OF_TRICKS]);

    expect(getItem(dataDir, "Longsword", "PHB")).toEqual(LONGSWORD);
    expect(getItem(dataDir, "Bag of Tricks", "DMG")).toEqual(BAG_OF_TRICKS);
    expect(getItem(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});
