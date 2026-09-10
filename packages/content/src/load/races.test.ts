import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent } from "../build-db.ts";
import { EDITION_FILES } from "./edition.ts";
import { races } from "./races.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

type Entry = Record<string, unknown>;

describe("the races loader", () => {
  let workspace: string;
  let dbPath: string;

  const build = (vendorDir: string) =>
    buildContent({ vendorDir, dbPath, loaders: [races], meta: {} });

  const open = () => new Database(dbPath, { readonly: true });

  const query = <T>(sql: string, ...parameters: unknown[]): T[] => {
    const db = open();
    const rows = db.prepare(sql).all(...parameters) as T[];
    db.close();
    return rows;
  };

  /** One subrace's merged entry, which is what the sheet reads. */
  const merged = (name: string, source: string): Entry => {
    const db = open();
    const json = db
      .prepare("SELECT json FROM subraces WHERE name = ? AND source = ?")
      .pluck()
      .get(name, source) as string;
    db.close();
    return JSON.parse(json) as Entry;
  };

  const traits = (entry: Entry): unknown[] => (entry.entries as Entry[]).map((held) => held.name);

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-races-"));
    dbPath = join(workspace, "data", "content.db");
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  describe("over the fixtures", () => {
    beforeEach(() => build(FIXTURE_VENDOR));

    it("keys a race by (name, source), versions beside the entry they were written under", () => {
      expect(query("SELECT name, source, edition FROM races")).toEqual([
        { name: "Goblin", source: "MPMM", edition: "classic" },
        { name: "Boggart", source: "LFL", edition: "classic" },
        { name: "Goblin", source: "VGM", edition: "classic" },
        { name: "Goblin (Dankwood)", source: "AWM", edition: "classic" },
        { name: "Aasimar", source: "MPMM", edition: "classic" },
        { name: "Aasimar; Necrotic Shroud", source: "MPMM", edition: "classic" },
        { name: "Aasimar; Radiant Consumption", source: "MPMM", edition: "classic" },
        { name: "Dragonborn", source: "XPHB", edition: "one" },
        { name: "Dragonborn (Black)", source: "XPHB", edition: "one" },
        { name: "Dragonborn (Blue)", source: "XPHB", edition: "one" },
        { name: "Elf", source: "XPHB", edition: "one" },
        // Both take their edition from the Elf|XPHB they copy, over their source's.
        { name: "Elf", source: "LFL", edition: "one" },
        { name: "Elf; Lorwyn Lineage", source: "LFL", edition: "one" },
        { name: "Human", source: "PHB", edition: "classic" },
        { name: "Dragonborn", source: "PHB", edition: "classic" },
        { name: "Dragonborn (Chromatic)", source: "FTD", edition: "classic" },
        { name: "Dragonborn (Chromatic; Black)", source: "FTD", edition: "classic" },
        { name: "Dragonborn (Chromatic; Blue)", source: "FTD", edition: "classic" },
      ]);
    });

    it("keys a subrace by the four parts that make it unique", () => {
      expect(query("SELECT name, source, race_name, race_source, edition FROM subraces")).toEqual([
        {
          name: "Variant",
          source: "PHB",
          race_name: "Human",
          race_source: "PHB",
          edition: "classic",
        },
        {
          name: "",
          source: "PHB",
          race_name: "Dragonborn",
          race_source: "PHB",
          edition: "classic",
        },
        {
          name: "Dragonborn (Black)",
          source: "PHB",
          race_name: "Dragonborn",
          race_source: "PHB",
          edition: "classic",
        },
        {
          name: "Dragonborn (Blue)",
          source: "PHB",
          race_name: "Dragonborn",
          race_source: "PHB",
          edition: "classic",
        },
        {
          name: "Draconblood",
          source: "EGW",
          race_name: "Dragonborn",
          race_source: "PHB",
          edition: "classic",
        },
        {
          name: "Dragonborn (Draconblood; Black)",
          source: "EGW",
          race_name: "Dragonborn",
          race_source: "PHB",
          edition: "classic",
        },
        {
          name: "Amonkhet",
          source: "PSA",
          race_name: "Human",
          race_source: "PHB",
          edition: "classic",
        },
      ]);
    });

    it("holds the race's traits and the subrace's in one row", () => {
      expect(traits(merged("Variant", "PHB"))).toEqual(["Age", "Size", "Languages", "Skills"]);
    });

    it("leaves the race's identity and printing history off the subrace", () => {
      const variant = merged("Variant", "PHB");
      expect(variant).toMatchObject({ name: "Variant", source: "PHB", page: 31 });
      expect(variant).not.toHaveProperty("reprintedAs");
    });

    it("replaces the trait an entry's data.overwrite names, rather than listing a second", () => {
      // Amonkhet reaches this through a _copy: the copy appends an Age the
      // merge then lays over the Human's, so both mechanisms run in order.
      expect(traits(merged("Amonkhet", "PSA"))).toEqual([
        "Age",
        "Size",
        "Languages",
        "Skills",
        "Alignment",
      ]);
      expect(traits(merged("Draconblood", "EGW"))).toEqual([
        "Age",
        "Size",
        "Draconic Ancestry",
        "Breath Weapon",
        "Forceful Presence",
        "Languages",
        "Darkvision",
      ]);
    });

    it("replaces an inherited field the subrace's overwrite names", () => {
      // The Draconblood is INT and CHA, not the Dragonborn's STR and CHA.
      expect(merged("Draconblood", "EGW").ability).toEqual([{ int: 2, cha: 1 }]);
    });

    it("drops an inherited field the subrace sets to null", () => {
      // The Dragonborn chooses one of five damage resistances. The Draconblood
      // has none, and says so by writing the field as null.
      expect(
        query<{ resist: string | null }>(
          "SELECT json_extract(json, '$.resist') AS resist FROM races WHERE name = ? AND source = ?",
          "Dragonborn",
          "PHB",
        )[0]?.resist,
      ).toContain("choose");
      expect(merged("Draconblood", "EGW")).not.toHaveProperty("resist");
    });

    it("expands a version whose _mod revises a trait only the race carries", () => {
      // The whole reason a subrace row is merged rather than a delta: nothing
      // else resolves these, and they are every colour the PHB dragonborn has.
      const black = merged("Dragonborn (Black)", "PHB");
      expect(traits(black)).toEqual([
        "Age",
        "Size",
        "Breath Weapon",
        "Damage Resistance",
        "Languages",
      ]);
      expect(black.resist).toEqual(["acid"]);
      const [breath] = (black.entries as Entry[]).filter((held) => held.name === "Breath Weapon");
      expect(JSON.stringify(breath)).toContain("5-foot-wide, 30-foot-long line");
    });

    it("reads a race's misplaced version variable as the field beside it", () => {
      expect(
        query(
          "SELECT json_extract(json, '$.resist') AS resist FROM races WHERE name = ? AND source = ?",
          "Dragonborn (Chromatic; Blue)",
          "FTD",
        ),
      ).toEqual([{ resist: '["lightning"]' }]);
    });
  });

  describe("merging a subrace into its race", () => {
    const ELF: Entry = {
      name: "Elf",
      source: "PHB",
      ability: [{ dex: 2 }],
      traitTags: ["Improved Resting"],
      languageProficiencies: [{ common: true, elvish: true }],
      entries: [{ type: "entries", name: "Keen Senses", entries: ["Elided."] }],
    };

    const HIGH: Entry = { name: "High", source: "PHB", raceName: "Elf", raceSource: "PHB" };

    const vendorHolding = (race: Entry[], subrace: Entry[]): string => {
      const vendorDir = join(workspace, "vendor");
      mkdirSync(join(vendorDir, "data"), { recursive: true });
      writeFileSync(join(vendorDir, "data", "races.json"), JSON.stringify({ race, subrace }));
      for (const file of EDITION_FILES) {
        const destination = join(vendorDir, file);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(join(FIXTURE_VENDOR, file), destination);
      }
      return vendorDir;
    };

    /** The reason, not the `Loader "races" failed` wrapper every failure shares. */
    const refusal = (race: Entry[], subrace: Entry[]): string => {
      try {
        build(vendorHolding(race, subrace));
      } catch (error) {
        const { cause } = error as Error;
        return cause instanceof Error ? cause.message : String(cause);
      }
      throw new Error("the build succeeded");
    };

    const highElf = (fields: Entry): Entry => {
      build(vendorHolding([ELF], [{ ...HIGH, ...fields }]));
      return merged("High", "PHB");
    };

    it("adds the subrace's list to the race's", () => {
      expect(highElf({ traitTags: ["Trance"] }).traitTags).toEqual(["Improved Resting", "Trance"]);
    });

    it("replaces the race's list where overwrite names it", () => {
      expect(highElf({ traitTags: ["Trance"], overwrite: { traitTags: true } }).traitTags).toEqual([
        "Trance",
      ]);
    });

    it("lays the subrace's ability increases over the race's, slot by slot", () => {
      expect(highElf({ ability: [{ int: 1 }] }).ability).toEqual([{ dex: 2, int: 1 }]);
      expect(highElf({ ability: [{ int: 1 }], overwrite: { ability: true } }).ability).toEqual([
        { int: 1 },
      ]);
    });

    it("refuses two ability arrays that do not offer the same number of choices", () => {
      expect(refusal([ELF], [{ ...HIGH, ability: [{ int: 1 }, { wis: 1 }] }])).toMatch(
        /the race offers 1 ability entries and the subrace 2/,
      );
    });

    it("refuses a proficiency choice, which has no rule for which set is picked from", () => {
      expect(
        refusal(
          [{ ...ELF, skillProficiencies: [{ perception: true }, { insight: true }] }],
          [{ ...HIGH, skillProficiencies: [{ history: true }] }],
        ),
      ).toMatch(/merging a choice of proficiencies is not handled/);
    });

    it("refuses an overwrite of a field the merge replaces anyway", () => {
      expect(refusal([ELF], [{ ...HIGH, overwrite: { entries: true } }])).toMatch(
        /overwrite names entries, which the merge does not add to/,
      );
    });

    it("refuses an overwrite that is not a flag", () => {
      expect(refusal([ELF], [{ ...HIGH, overwrite: { ability: "yes" } }])).toMatch(
        /overwrite\.ability is not a flag/,
      );
    });

    it("refuses a subrace naming a race the file does not carry", () => {
      expect(refusal([ELF], [{ ...HIGH, raceName: "Dwarf" }])).toMatch(
        /no race Dwarf\|PHB to merge with/,
      );
    });

    it("fails the build when two subraces share all four parts of the key", () => {
      expect(refusal([ELF], [HIGH, HIGH])).toMatch(/UNIQUE constraint failed: subraces\./);
    });
  });
});
