import { describe, expect, it } from "vitest";
import {
  byNameSource,
  collectFluff,
  drainUnmatchedFluff,
  fluffKey,
  isFluffPath,
  withFluff,
} from "./fluff.ts";

describe("fluffKey", () => {
  it("folds every part to lowercase and joins them", () => {
    expect(fluffKey("Path of the Berserker", "XPHB", "Barbarian")).toBe(
      "path of the berserker|xphb|barbarian",
    );
  });
});

describe("byNameSource", () => {
  it("keys an entry by its own name and source", () => {
    expect(byNameSource({ name: "Acolyte", source: "PHB" }, "ctx")).toBe("acolyte|phb");
  });

  it("refuses an entry with no name", () => {
    expect(() => byNameSource({ source: "PHB" }, "ctx")).toThrow(
      "ctx: name is missing or not a string",
    );
  });
});

describe("isFluffPath", () => {
  it.each([
    ["data/fluff-races.json", true],
    ["data/bestiary/fluff-bestiary-mm.json", true],
    ["data/races.json", false],
    ["data/bestiary/bestiary-mm.json", false],
  ])("%s -> %s", (path, expected) => {
    expect(isFluffPath(path)).toBe(expected);
  });
});

describe("collectFluff", () => {
  const files: [string, unknown][] = [
    ["data/fluff-a.json", { thingFluff: [{ name: "Foo", source: "PHB", entries: ["Elided."] }] }],
    ["data/fluff-b.json", { thingFluff: [{ name: "Bar", source: "PHB" }] }],
  ];

  it("pools every file's array under one lookup", () => {
    const pool = collectFluff(files, "thingFluff", byNameSource);
    expect(pool("foo|phb")).toEqual({ name: "Foo", source: "PHB", entries: ["Elided."] });
    expect(pool("bar|phb")).toEqual({ name: "Bar", source: "PHB" });
    expect(pool("baz|phb")).toBeUndefined();
  });

  it("treats a file with no array of that kind as carrying none", () => {
    const pool = collectFluff(
      [["data/fluff-c.json", { otherFluff: [] }]],
      "thingFluff",
      byNameSource,
    );
    expect(pool("foo|phb")).toBeUndefined();
  });
});

describe("drainUnmatchedFluff", () => {
  const fileA: [string, unknown] = [
    "data/fluff-a.json",
    { thingFluff: [{ name: "Foo", source: "PHB" }] },
  ];
  const fileB: [string, unknown] = [
    "data/fluff-b.json",
    { thingFluff: [{ name: "Bar", source: "PHB" }] },
  ];

  it("carries an entry no lookup ever claimed, alongside the file it came from", () => {
    const pool = collectFluff([fileA, fileB], "thingFluff", byNameSource);
    pool("foo|phb");

    expect(drainUnmatchedFluff()).toEqual([["data/fluff-b.json", { name: "Bar", source: "PHB" }]]);
  });

  it("leaves out an entry a lookup claimed", () => {
    const pool = collectFluff([fileA, fileB], "thingFluff", byNameSource);
    pool("foo|phb");
    pool("bar|phb");

    expect(drainUnmatchedFluff()).toEqual([]);
  });

  it("pools every collectFluff call since the last drain, not just the latest", () => {
    collectFluff([fileA], "thingFluff", byNameSource);
    collectFluff([fileB], "thingFluff", byNameSource);

    expect(drainUnmatchedFluff()).toEqual([
      ["data/fluff-a.json", { name: "Foo", source: "PHB" }],
      ["data/fluff-b.json", { name: "Bar", source: "PHB" }],
    ]);
  });

  it("empties on drain, so a later build does not re-report what this one returned", () => {
    collectFluff([fileA, fileB], "thingFluff", byNameSource);
    drainUnmatchedFluff();

    expect(drainUnmatchedFluff()).toEqual([]);
  });
});

describe("withFluff", () => {
  const context = "ctx";

  it("returns the entry unchanged where nothing matches and nothing was promised", () => {
    const entry = { name: "Foo", source: "PHB" };
    expect(withFluff(entry, undefined, context)).toBe(entry);
  });

  it("refuses an entry whose hasFluff promises a match no pool held", () => {
    const entry = { name: "Foo", source: "PHB", hasFluff: true };
    expect(() => withFluff(entry, undefined, context)).toThrow(
      "ctx: hasFluff promises a fluff entry no file carries",
    );
  });

  it("refuses on hasFluffImages just as it does on hasFluff, naming which one", () => {
    const entry = { name: "Foo", source: "PHB", hasFluffImages: true };
    expect(() => withFluff(entry, undefined, context)).toThrow(
      "ctx: hasFluffImages promises a fluff entry no file carries",
    );
  });

  it("merges a match under a `fluff` field, stripping the fields that only named it", () => {
    const entry = { name: "Foo", source: "PHB", hasFluff: true };
    const found = {
      name: "Foo",
      source: "PHB",
      className: "Fighter",
      classSource: "PHB",
      shortName: "Foo",
      entries: ["Elided."],
      images: [{ type: "image" }],
    };

    expect(withFluff(entry, found, context)).toEqual({
      ...entry,
      fluff: { entries: ["Elided."], images: [{ type: "image" }] },
    });
  });

  it("merges an unpromised match too, since more lore is never wrong", () => {
    const entry = { name: "Foo", source: "PHB" };
    const found = { name: "Foo", source: "PHB", entries: ["Elided."] };

    expect(withFluff(entry, found, context)).toEqual({ ...entry, fluff: { entries: ["Elided."] } });
  });

  it("adds no `fluff` field where the match carries nothing but identity", () => {
    const entry = { name: "Foo", source: "PHB", hasFluffImages: true };
    const found = { name: "Foo", source: "PHB" };
    expect(withFluff(entry, found, context)).toEqual(entry);
  });
});
