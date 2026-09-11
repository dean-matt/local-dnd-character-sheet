import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCopies } from "./copy.ts";
import { races } from "./races.ts";
import { resolveVersions } from "./versions.ts";

const FIXTURES = resolve(import.meta.dirname, "../../../../tests/fixtures/5etools");

type Entry = Record<string, unknown>;

/** As the framework does it: copies, then the loader's prepare, then versions. */
function load(file: string, property: string): Entry[] {
  const path = `data/${file}`;
  const parsed = JSON.parse(readFileSync(join(FIXTURES, "data", file), "utf8"));
  const copied = resolveCopies(new Map([[path, parsed]])).get(path);
  const resolved = resolveVersions(races.prepare?.(copied, path), path) as Record<string, Entry[]>;
  const entries = resolved[property];
  if (!entries) throw new Error(`${file} has no ${property}`);
  return entries;
}

function find(entries: Entry[], name: string): Entry {
  const found = entries.find((entry) => entry.name === name);
  if (!found) throw new Error(`no entry named ${name}`);
  return found;
}

const names = (entry: Entry): unknown[] => (entry.entries as Entry[]).map((child) => child.name);

const file = (...race: Entry[]) => ({ _meta: { internalCopies: ["race"] }, race });

const refusal = (source: unknown): string => {
  try {
    resolveVersions(source, "data/races.json");
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("nothing was refused");
};

describe("resolveVersions", () => {
  it("leaves a file carrying no _versions alone", () => {
    const source = { spell: [{ name: "Fireball", source: "PHB" }] };
    expect(resolveVersions(source, "data/spells/spells-phb.json")).toBe(source);
  });

  describe("races.json", () => {
    const races = load("races.json", "race");

    it("keeps the entry a version was written under, beside its versions", () => {
      expect(races.map((race) => `${String(race.name)}|${String(race.source)}`)).toEqual([
        "Goblin|MPMM",
        "Boggart|LFL",
        "Goblin|VGM",
        "Goblin (Dankwood)|AWM",
        "Aasimar|MPMM",
        "Aasimar; Necrotic Shroud|MPMM",
        "Aasimar; Radiant Consumption|MPMM",
        "Dragonborn|XPHB",
        "Dragonborn (Black)|XPHB",
        "Dragonborn (Blue)|XPHB",
        "Elf|XPHB",
        "Elf|LFL",
        "Elf; Lorwyn Lineage|LFL",
        "Human|PHB",
        "Dragonborn|PHB",
        "Half-Orc|PHB",
        "Dragonborn (Chromatic)|FTD",
        "Dragonborn (Chromatic; Black)|FTD",
        "Dragonborn (Chromatic; Blue)|FTD",
      ]);
    });

    it("leaves no _versions on the base or on a version", () => {
      expect(races.filter((race) => "_versions" in race)).toEqual([]);
    });

    it("applies a version's own _mod to a clone, leaving the base untouched", () => {
      expect(names(find(races, "Aasimar"))).toEqual(["Celestial Revelation", "Healing Hands"]);
      expect(names(find(races, "Aasimar; Necrotic Shroud"))).toEqual([
        "Celestial Revelation (Necrotic Shroud)",
        "Healing Hands",
      ]);
    });

    it("fills a template's placeholders from each implementation", () => {
      const black = find(races, "Dragonborn (Black)");
      expect(names(black)).toEqual(["Breath Weapon"]);
      const [filled] = ((black.entries as Entry[])[0] as Entry).entries as string[];
      expect(filled).toContain("Acid");
      expect(filled).not.toContain("{{damageType}}");
    });

    it("lays an implementation's own fields over the filled template", () => {
      expect(find(races, "Dragonborn (Blue)").resist).toEqual(["lightning"]);
      expect(find(races, "Dragonborn").resist).not.toEqual(["lightning"]);
    });

    it("expands a version of an entry that is itself a copy", () => {
      // Elf|LFL inherits Elven Lineage from Elf|XPHB, and its version replaces
      // an element of the list the copy supplied — which only holds if copies run first.
      expect(names(find(races, "Elf; Lorwyn Lineage"))).toEqual(["Elven Lineage (Lorwyn)"]);
    });
  });

  /**
   * The shapes only `data/bestiary/` writes. `renameArr` reaches nothing outside
   * one: all 63 uses sit in a bestiary `_versions` `_mod`, and character data
   * writes four modes, none of them this one.
   */
  describe("across the bestiary", () => {
    const bestiary = (path: string, ...monster: Entry[]): [string, unknown] => [path, { monster }];

    /** As `readSources` runs them: copies over the whole set, then versions per file. */
    const expand = (...files: [string, unknown][]): Entry[] =>
      [...resolveCopies(new Map(files))].flatMap(
        ([path, source]) =>
          (resolveVersions(source, path) as Record<string, Entry[]>).monster ?? [],
      );

    const traits = (entry: Entry): unknown[] => (entry.trait as Entry[]).map((one) => one.name);

    const spirit = (mod: unknown): [string, unknown] =>
      bestiary("data/bestiary/bestiary-tce.json", {
        name: "Aberrant Spirit",
        source: "TCE",
        trait: [
          { name: "Regeneration (Slaad Only)" },
          { name: "Whispering Aura (Star Spawn Only)" },
        ],
        _versions: [{ name: "Aberrant Spirit (Slaad)", source: "TCE", _mod: mod }],
      });

    it("renames an element on the version, leaving the entry it was written under alone", () => {
      const monsters = expand(
        spirit({
          trait: {
            mode: "renameArr",
            renames: { rename: "Regeneration (Slaad Only)", with: "Regeneration" },
          },
        }),
      );

      expect(monsters.map(traits)).toEqual([
        ["Regeneration (Slaad Only)", "Whispering Aura (Star Spawn Only)"],
        ["Regeneration", "Whispering Aura (Star Spawn Only)"],
      ]);
    });

    it("renames every element a list of renames names", () => {
      const monsters = expand(
        spirit({
          trait: {
            mode: "renameArr",
            renames: [
              { rename: "Regeneration (Slaad Only)", with: "Regeneration" },
              { rename: "Whispering Aura (Star Spawn Only)", with: "Whispering Aura" },
            ],
          },
        }),
      );

      expect(traits(monsters[1] as Entry)).toEqual(["Regeneration", "Whispering Aura"]);
    });

    it("refuses a rename matching no element, the way replaceArr does", () => {
      expect(() =>
        expand(
          spirit({ trait: { mode: "renameArr", renames: { rename: "Parry", with: "Riposte" } } }),
        ),
      ).toThrow('renameArr matched no element named "Parry"');
    });

    it("refuses a rename that is not a pair of names", () => {
      expect(() =>
        expand(spirit({ trait: { mode: "renameArr", renames: { with: "Parry" } } })),
      ).toThrow('renameArr needs a "rename" and a "with", both text');
    });
  });

  describe("failing the build", () => {
    const base = { name: "Elf", source: "PHB", entries: [{ type: "entries", name: "Keen" }] };

    it("names the entry when a version is not an object", () => {
      expect(refusal(file({ ...base, _versions: [null] }))).toBe(
        'data/races.json race: "Elf" (PHB): a _versions block is not an object',
      );
    });

    it("refuses a template with no implementations to fill it", () => {
      expect(
        refusal(file({ ...base, _versions: [{ _abstract: { name: "Elf ({{x}})" } }] })),
      ).toMatch(/_abstract and _implementations come as a pair/);
    });

    it("refuses a placeholder no variable fills, rather than storing the braces", () => {
      expect(
        refusal(
          file({
            ...base,
            _versions: [
              { _abstract: { name: "Elf ({{color}})" }, _implementations: [{ _variables: {} }] },
            ],
          }),
        ),
      ).toMatch(/\{\{color\}\} was never given a value/);
    });

    const templated = (template: Entry, variables: Entry) =>
      file({
        ...base,
        _versions: [{ _abstract: template, _implementations: [{ _variables: variables }] }],
      });

    it("refuses a text variable no placeholder uses, rather than dropping what it says", () => {
      expect(
        refusal(
          templated({ name: "Elf ({{color}})", source: "PHB" }, { color: "Wood", kind: "fey" }),
        ),
      ).toMatch(/_variables\.kind is set, and no \{\{kind\}\} uses it/);
    });

    it("reads an unused variable that is not text as a field written one level too deep", () => {
      // FTD's chromatic dragonborn is this shape: each colour states its damage
      // resistance inside _variables, where the PHB and EGW dragonborn state
      // the same key, in the same shape, beside it.
      const resolved = resolveVersions(
        templated({ name: "Elf ({{color}})", source: "PHB" }, { color: "Wood", resist: ["fire"] }),
        "data/races.json",
      ) as { race: Entry[] };

      expect(resolved.race[1]).toMatchObject({ name: "Elf (Wood)", resist: ["fire"] });
    });

    it("refuses a variable that is not text, since a placeholder holds text", () => {
      expect(
        refusal(templated({ name: "Elf of {{kind}} kind", source: "PHB" }, { kind: ["wood"] })),
      ).toMatch(/_variables\.kind is not text/);
    });

    it("refuses a placeholder named after something on Object's prototype", () => {
      expect(refusal(templated({ name: "Elf ({{constructor}})", source: "PHB" }, {}))).toMatch(
        /\{\{constructor\}\} was never given a value/,
      );
    });

    it("fills a variable named after a prototype key, which a file can carry", () => {
      // Written through JSON, where "__proto__" is an ordinary key rather than
      // the setter an object literal would reach.
      const source = JSON.parse(
        JSON.stringify(
          templated({ name: "Elf ({{proto}})", source: "PHB" }, { proto: "Wood" }),
        ).replace(/proto/g, "__proto__"),
      );

      const resolved = resolveVersions(source, "data/races.json") as { race: Entry[] };
      expect(resolved.race[1]?.name).toBe("Elf (Wood)");
    });

    it("fills a placeholder standing in an object key, not only in a value", () => {
      const resolved = resolveVersions(
        templated({ name: "Elf", source: "PHB", "{{color}}Resist": "some" }, { color: "Wood" }),
        "data/races.json",
      ) as { race: Entry[] };

      expect(resolved.race[1]).toHaveProperty("WoodResist", "some");
    });

    it("drops a _versions a version declares of its own, which nothing revisits", () => {
      const resolved = resolveVersions(
        file({
          ...base,
          _versions: [
            { name: "Wood Elf", source: "PHB", _versions: [{ name: "Deeper", source: "PHB" }] },
          ],
        }),
        "data/races.json",
      ) as { race: Entry[] };

      expect(resolved.race.filter((entry) => "_versions" in entry)).toEqual([]);
    });
  });
});
