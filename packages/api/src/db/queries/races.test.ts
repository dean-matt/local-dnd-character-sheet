import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishRaces, publishSubraces } from "./contentFixture.ts";
import { getRace, getSubrace, listRaces, listSubraces } from "./races.ts";

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

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-races-"));
    publishRaces(dataDir, [ELF, TIEFLING_ONE]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists races filtered to one edition, sorted by name then source", () => {
    expect(listRaces(dataDir, "classic")).toEqual([ELF]);
    expect(listRaces(dataDir, "one")).toEqual([TIEFLING_ONE]);
  });

  it("reads one race by name and source", () => {
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

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-subraces-"));
    publishSubraces(dataDir, [HIGH_ELF, WOOD_ELF, HUMAN_BASE]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists subraces of one race, filtered to one edition", () => {
    expect(listSubraces(dataDir, "Elf", "PHB", "classic")).toEqual([HIGH_ELF, WOOD_ELF]);
    expect(listSubraces(dataDir, "Human", "PHB", "classic")).toEqual([HUMAN_BASE]);
  });

  it("reads one subrace by its own key and its race's", () => {
    expect(getSubrace(dataDir, "High", "PHB", "Elf", "PHB")).toEqual(HIGH_ELF);
    expect(getSubrace(dataDir, "High", "PHB", "Gnome", "PHB")).toBeUndefined();
  });

  it("allows the empty subrace name a base variant with no subrace of its own carries", () => {
    expect(getSubrace(dataDir, "", "PHB", "Human", "PHB")).toEqual(HUMAN_BASE);
  });
});
