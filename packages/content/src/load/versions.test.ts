import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCopies } from "./copy.ts";
import { resolveVersions } from "./versions.ts";

const FIXTURES = resolve(import.meta.dirname, "../../../../tests/fixtures/5etools");

type Entry = Record<string, unknown>;

/** As the framework does it: copies first, then versions over the result. */
function load(file: string, property: string): Entry[] {
  const parsed = JSON.parse(readFileSync(join(FIXTURES, "data", file), "utf8"));
  const resolved = resolveVersions(resolveCopies(parsed, `data/${file}`), `data/${file}`) as Record<
    string,
    Entry[]
  >;
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
      ]);
    });

    it("leaves no _versions on the base or on a version", () => {
      expect(races.filter((race) => "_versions" in race)).toEqual([]);
    });

    it("applies a version's own _mod to a clone, leaving the base untouched", () => {
      expect(names(find(races, "Aasimar"))).toEqual(["Celestial Revelation", "Healing Hands"]);
      expect(names(find(races, "Aasimar; Necrotic Shroud"))).toEqual([
        "Necrotic Shroud",
        "Healing Hands",
      ]);
    });

    it("fills a template's placeholders from each implementation", () => {
      const black = find(races, "Dragonborn (Black)");
      expect(names(black)).toEqual(["Breath Weapon"]);
      expect((black.entries as Entry[])[0]?.entries).toEqual(["Deals Acid damage."]);
    });

    it("lays an implementation's own fields over the filled template", () => {
      expect(find(races, "Dragonborn (Blue)").resist).toEqual(["lightning"]);
      expect(find(races, "Dragonborn").resist).not.toEqual(["lightning"]);
    });

    it("expands a version of an entry that is itself a copy", () => {
      // Elf|LFL inherits Elven Lineage from Elf|XPHB, and its version appends
      // to the list the copy supplied — which only holds if copies run first.
      expect(names(find(races, "Elf; Lorwyn Lineage"))).toEqual(["Elven Lineage", "Extra"]);
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

    it("refuses a variable no placeholder uses, rather than dropping what it says", () => {
      // FTD's chromatic dragonborn is this shape: five colours declaring a
      // resistance the template never mentions, which would file all five under
      // the base's "choose one of five" with nothing to show for it.
      expect(
        refusal(
          templated(
            { name: "Elf ({{color}})", source: "PHB" },
            { color: "Wood", resist: ["fire"] },
          ),
        ),
      ).toMatch(/_variables\.resist is set, and no \{\{resist\}\} uses it/);
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
