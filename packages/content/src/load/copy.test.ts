import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCopies } from "./copy.ts";

/**
 * Fixtures under `tests/fixtures/5etools/` mirror the real files structurally —
 * the same identity fields, `_mod` modes and `_preserve` blocks — with the rules
 * prose elided, because that text is WotC's and is never committed (see NOTICE).
 */
const FIXTURES = resolve(import.meta.dirname, "../../../../tests/fixtures/5etools");

type Entry = Record<string, unknown>;

function load(file: string, property: string): Entry[] {
  const parsed = JSON.parse(readFileSync(join(FIXTURES, "data", file), "utf8"));
  const resolved = resolveCopies(parsed, `data/${file}`) as Record<string, Entry[] | undefined>;
  const entries = resolved[property];
  if (!entries) throw new Error(`${file} has no ${property}`);
  return entries;
}

function find(entries: Entry[], match: Entry): Entry {
  const found = entries.find((entry) =>
    Object.entries(match).every(([key, value]) => entry[key] === value),
  );
  if (!found) throw new Error(`no entry matching ${JSON.stringify(match)}`);
  return found;
}

const names = (entry: Entry): unknown[] => (entry.entries as Entry[]).map((child) => child.name);

describe("resolveCopies", () => {
  it("leaves a file with no _meta.internalCopies alone", () => {
    const source = { spell: [{ name: "Fireball", source: "PHB" }] };
    expect(resolveCopies(source, "data/spells/spells-phb.json")).toBe(source);
  });

  describe("backgrounds.json", () => {
    const backgrounds = load("backgrounds.json", "background");

    it("inherits the parent's own fields and strips the _copy block", () => {
      const acolyte = find(backgrounds, { name: "Baldur's Gate Acolyte" });
      expect(acolyte._copy).toBeUndefined();
      expect(acolyte.skillProficiencies).toEqual([{ insight: true, religion: true }]);
    });

    it("applies insertArr at the index it names", () => {
      const acolyte = find(backgrounds, { name: "Baldur's Gate Acolyte" });
      expect(names(acolyte)).toEqual([
        undefined,
        "Feature: Shelter of the Faithful",
        "Baldur's Gate Feature: Religious Community",
        undefined,
      ]);
    });

    it("applies replaceArr by the name of the element it replaces", () => {
      expect(names(find(backgrounds, { name: "Variant Criminal (Spy)" }))).toEqual([
        undefined,
        "Feature: Spy Contact",
      ]);
    });

    it("resolves a chain whose parent is itself a copy", () => {
      const augen = find(backgrounds, { name: "Augen Trust (Spy)" });
      expect(names(augen)).toEqual([undefined, "Feature: Spy Contact"]);
      expect(augen.skillProficiencies).toEqual([{ deception: true, stealth: true }]);
    });

    it("does not inherit metadata the copy did not preserve", () => {
      const augen = find(backgrounds, { name: "Augen Trust (Spy)" });
      expect(augen.page).toBe(203);
      expect(augen.basicRules).toBeUndefined();
    });
  });

  describe("items.json", () => {
    const items = load("items.json", "item");

    it("resolves a four-deep chain, each level keeping its own fields", () => {
      const ascendant = find(items, { name: "Ascendant Dragon Vessel" });
      expect(ascendant.rarity).toBe("legendary");
      expect(ascendant.wondrous).toBe(true);
      expect(ascendant.reqAttune).toBe(true);
      expect(ascendant.entries).toEqual([
        "Elided.",
        "Ascendant: {@item potion of supreme healing}.",
      ]);
    });

    it("keeps the parent's page where _preserve names it", () => {
      expect(find(items, { name: "Ascendant Dragon Vessel" }).page).toBe(27);
    });

    it("treats a bare items value as a single-element list", () => {
      const charred = find(items, { name: "Charred Wand of Magic Missiles" });
      expect(charred.entries).toHaveLength(3);
      expect(charred.charges).toBe(7);
      expect(charred.srd).toBeUndefined();
    });
  });

  describe("races.json", () => {
    const races = load("races.json", "race");
    const subraces = load("races.json", "subrace");

    it("matches the parent on source, not name alone", () => {
      const dankwood = find(races, { name: "Goblin (Dankwood)" });
      expect(dankwood.reprintedAs).toEqual(["Goblin|MPMM"]);
    });

    it("applies a list of _mod operations in order", () => {
      const dankwood = find(races, { name: "Goblin (Dankwood)" });
      expect(names(dankwood)).toEqual([
        "Darkvision",
        "Speak with Small Beasts",
        undefined,
        "Alignment",
      ]);
    });

    it("applies replaceTxt to the prose, honoring its flags", () => {
      const [darkvision] = find(races, { name: "Goblin (Dankwood)" }).entries as Entry[];
      expect(darkvision?.entries).toEqual(["Dankwood goblins see in the dark."]);
    });

    it("reaches every prose key of a table, and no structural one", () => {
      const entries = find(races, { name: "Goblin (Dankwood)" }).entries as Entry[];
      const table = entries.find((entry) => entry.type === "table");
      expect(table).toMatchObject({
        type: "table",
        caption: "Dankwood goblins by Type",
        colLabels: ["Dankwood goblins", "Trait"],
        colStyles: ["col-6", "col-6"],
        rows: [["Dankwood goblins", "Elided."]],
      });
    });

    it("leaves a reference string alone, so replaceTxt cannot break a link", () => {
      const [darkvision] = find(races, { name: "Goblin (Dankwood)" }).entries as Entry[];
      expect(darkvision?.data).toEqual({ overwrite: "Goblins" });
    });

    it("drops a field the child nulls out", () => {
      const boggart = find(races, { name: "Boggart" });
      expect(boggart.speed).toBe(30);
      expect("lineage" in boggart).toBe(false);
    });

    it("keys a subrace by its race as well as its own name and source", () => {
      const amonkhet = find(subraces, { name: "Amonkhet" });
      expect(amonkhet.raceName).toBe("Human");
      expect(amonkhet.raceSource).toBe("PHB");
      expect(names(amonkhet)).toEqual(["Skills", "Age", "Alignment"]);
    });
  });

  describe("class/class-cleric.json", () => {
    const subclasses = load("class/class-cleric.json", "subclass");
    const features = load("class/class-cleric.json", "subclassFeature");

    it("resolves a subclass across editions of the same class", () => {
      const subclass = find(subclasses, { classSource: "XPHB" });
      expect(subclass.page).toBe(59);
      expect(subclass.subclassFeatures).toEqual([
        "Knowledge Domain|Cleric|XPHB|Knowledge||3",
        "Visions of the Past|Cleric||Knowledge||17",
      ]);
    });

    it("does not carry isReprinted onto the row that supersedes it", () => {
      const subclass = find(subclasses, { classSource: "XPHB" });
      expect(subclass.isReprinted).toBeUndefined();
      expect(find(subclasses, { classSource: "PHB" }).isReprinted).toBe(true);
    });

    it("uses every field the _copy block names, so a shared (name, source) is not ambiguous", () => {
      const feature = find(features, { classSource: "XPHB" });
      expect(feature.level).toBe(3);
      expect(feature.header).toBe(2);
      expect(feature.entries).toEqual(["Elided.", "Deals {@damage 1d10} necrotic damage."]);
    });
  });

  describe("failing the build", () => {
    const file = (...entries: Entry[]) => ({
      _meta: { internalCopies: ["background"] },
      background: entries,
    });

    it("names both entries when the parent does not exist", () => {
      expect(() =>
        resolveCopies(
          file({ name: "Augen Trust", source: "EGW", _copy: { name: "Spy", source: "PHB" } }),
          "data/backgrounds.json",
        ),
      ).toThrow(
        'data/backgrounds.json background: "Augen Trust" (EGW) copies "Spy" (PHB), which no entry in the file matches',
      );
    });

    it("names both entries in a cycle", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", _copy: { name: "B", source: "PHB" } },
            { name: "B", source: "PHB", _copy: { name: "A", source: "PHB" } },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow(/"B" \(PHB\) copies "A" \(PHB\), which is already being resolved — _copy cycle/);
    });

    it("catches an entry that copies itself", () => {
      expect(() =>
        resolveCopies(
          file({ name: "A", source: "PHB", _copy: { name: "A", source: "PHB" } }),
          "data/backgrounds.json",
        ),
      ).toThrow(/_copy cycle/);
    });

    it("refuses an unsupported _mod mode rather than importing a half-applied record", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: [] },
            {
              name: "B",
              source: "PHB",
              _copy: { name: "A", source: "PHB", _mod: { entries: { mode: "setProp" } } },
            },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow('unsupported _mod mode "setProp"');
    });

    it("refuses a _copy that no _meta.internalCopies claims", () => {
      expect(() =>
        resolveCopies(
          {
            background: [
              { name: "Acolyte", source: "PHB" },
              { name: "Augen Trust", source: "EGW", _copy: { name: "Acolyte", source: "PHB" } },
            ],
          },
          "data/bestiary/bestiary-bmt.json",
        ),
      ).toThrow(
        'data/bestiary/bestiary-bmt.json background: "Augen Trust" (EGW) carries a _copy that no _meta.internalCopies claims (1 in this property)',
      );
    });

    it("refuses a _copy under a property internalCopies does not name", () => {
      expect(() =>
        resolveCopies(
          {
            _meta: { internalCopies: ["background"] },
            background: [{ name: "Acolyte", source: "PHB" }],
            itemGroup: [
              { name: "Robes", source: "PHB" },
              { name: "Vestments", source: "PHB", _copy: { name: "Robes", source: "PHB" } },
            ],
          },
          "data/backgrounds.json",
        ),
      ).toThrow(/itemGroup: "Vestments" \(PHB\) carries a _copy/);
    });

    it("refuses a wildcard _mod property rather than writing it as a key", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: [] },
            {
              name: "B",
              source: "PHB",
              _copy: {
                name: "A",
                source: "PHB",
                _mod: { "*": { mode: "replaceTxt", replace: "x", with: "y" } },
              },
            },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow('unsupported _mod property "*"');
    });

    it("refuses an array mode with no items rather than splicing in undefined", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: [] },
            {
              name: "B",
              source: "PHB",
              _copy: { name: "A", source: "PHB", _mod: { entries: { mode: "appendArr" } } },
            },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow("appendArr needs items");
    });

    it("appends to a property the parent does not have, rather than refusing", () => {
      const resolved = resolveCopies(
        file(
          { name: "A", source: "PHB" },
          {
            name: "B",
            source: "PHB",
            _copy: {
              name: "A",
              source: "PHB",
              _mod: { entries: { mode: "appendArr", items: "Added." } },
            },
          },
        ),
        "data/items.json",
      ) as { background: Entry[] };

      expect(find(resolved.background, { name: "B" }).entries).toEqual(["Added."]);
    });

    it("refuses a _mod against a property that is present and not a list", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: "not a list" },
            {
              name: "B",
              source: "PHB",
              _copy: {
                name: "A",
                source: "PHB",
                _mod: { entries: { mode: "appendArr", items: "Added." } },
              },
            },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow("_mod.entries expects a list, found string");
    });

    it("refuses a replaceArr index past the end rather than letting splice clamp", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: [{ name: "Only" }] },
            {
              name: "B",
              source: "PHB",
              _copy: {
                name: "A",
                source: "PHB",
                _mod: { entries: { mode: "replaceArr", replace: { index: 7 }, items: {} } },
              },
            },
          ),
          "data/items.json",
        ),
      ).toThrow("replaceArr index 7 is outside a list of 1");
    });

    it("refuses a replaceTxt with no property to rewrite", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB" },
            {
              name: "B",
              source: "PHB",
              _copy: {
                name: "A",
                source: "PHB",
                _mod: { entries: { mode: "replaceTxt", replace: "x", with: "y" } },
              },
            },
          ),
          "data/races.json",
        ),
      ).toThrow("replaceTxt has no entries to rewrite");
    });

    it("refuses a _copy that names no parent instead of cloning the first entry", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: ["Not yours."] },
            { name: "B", source: "PHB", _copy: { _mod: {} } },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow('"B" (PHB) has a _copy that names no parent');
    });

    it("keeps the file and entry label when an entry is not an object", () => {
      expect(() =>
        resolveCopies(file({ name: "A", source: "PHB" }, null as unknown as Entry), "data/x.json"),
      ).toThrow("data/x.json background: expected entries to be objects, found object");
    });

    it("reports a replaceArr whose target is not there", () => {
      expect(() =>
        resolveCopies(
          file(
            { name: "A", source: "PHB", entries: [{ name: "Kept" }] },
            {
              name: "B",
              source: "PHB",
              _copy: {
                name: "A",
                source: "PHB",
                _mod: { entries: { mode: "replaceArr", replace: "Gone", items: {} } },
              },
            },
          ),
          "data/backgrounds.json",
        ),
      ).toThrow('replaceArr matched no element named "Gone"');
    });
  });
});
