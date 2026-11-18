import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "./build-db.ts";
import { characterOptions } from "./load/character-options.ts";
import { classes } from "./load/classes.ts";
import {
  type Counts,
  countGaps,
  lowerBaseline,
  mechanicGaps,
  readBaseline,
  reportGaps,
  risen,
} from "./mechanic-gaps.ts";
import { CONTENT_SCHEMA } from "./schema.ts";

const VENDOR = join(import.meta.dirname, "../../../vendor/5etools");

const zero: Counts = {
  heal: 0,
  tempHp: 0,
  bonus: 0,
  armorClass: 0,
  unarmoredBase: 0,
  mediumArmorDexterity: 0,
  proficiency: 0,
  pick: 0,
  halfProficiency: 0,
  sense: 0,
  defense: 0,
  speed: 0,
  roll: 0,
  attack: 0,
  extraDamage: 0,
  martialArts: 0,
  unclassified: 0,
};

describe("mechanicGaps", () => {
  const db = new Database(":memory:");
  db.exec(CONTENT_SCHEMA);
  const json = (srd: object, text: string) => JSON.stringify({ ...srd, entries: [text] });
  db.prepare(
    "INSERT INTO class_features (name, source, class_name, class_source, level, edition, json) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "Hardy",
    "PHB",
    "Fighter",
    "PHB",
    3,
    "classic",
    json({ srd: true }, "resistance to fire, and darkvision"),
  );
  db.prepare(
    "INSERT INTO subclass_features (name, source, class_name, class_source, subclass_short_name, subclass_source, level, edition, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "Eyes of the Dark",
    "XGE",
    "Sorcerer",
    "PHB",
    "Shadow",
    "XGE",
    1,
    "classic",
    json({ srd: true }, "darkvision"),
  );
  const feat = db.prepare("INSERT INTO feats (name, source, edition, json) VALUES (?, ?, ?, ?)");
  feat.run("Alert", "PHB", "classic", json({ srd: true }, "+5 to initiative"));
  feat.run("Quick", "XPHB", "one", json({ srd52: true }, "a bonus to initiative"));
  feat.run("Wary", "XGE", "classic", json({}, "a bonus to initiative"));
  feat.run("Lucky", "PHB", "classic", json({ srd: true }, "reroll a d20"));
  feat.run("Steady", "PHB", "classic", json({ srd: true }, "advantage on saving throws"));
  feat.run("Aimed", "PHB", "classic", json({ srd: true }, "a +1 bonus to attack rolls"));
  feat.run(
    "Venom",
    "PHB",
    "classic",
    json({ srd: true }, "add a toxin to your strike, forcing the target to make a saving throw"),
  );
  feat.run(
    "Monk",
    "PHB",
    "classic",
    json({ srd: true }, "while you aren't wearing any armor, your AC equals 10 + Wisdom"),
  );
  feat.run(
    "Strider",
    "PHB",
    "classic",
    json({ srd: true }, "while you aren't wearing armor, you gain training with Medium armor"),
  );
  feat.run(
    "Smiting",
    "PHB",
    "classic",
    json({ srd: true }, "an extra {@damage 1d8} radiant damage"),
  );
  feat.run(
    "Fists",
    "PHB",
    "classic",
    json({ srd: true }, "roll a d4 in place of the normal damage of your unarmed strike"),
  );
  feat.run("Mending", "PHB", "classic", json({ srd: true }, "regain {@dice 1d10} hit points"));
  feat.run("Shielding", "PHB", "classic", json({ srd: true }, "gain 5 temporary hit points"));

  it("names an SRD feature with no record under each kind its text suggests", () => {
    const gaps = mechanicGaps(db);
    expect(gaps.defense).toEqual(["Hardy (PHB), Fighter level 3"]);
    expect(gaps.sense).toEqual(["Hardy (PHB), Fighter level 3"]);
    expect(gaps.bonus).toEqual(["Quick (XPHB)"]);
    expect(gaps.unarmoredBase).toEqual(["Monk (PHB)"]);
    expect(gaps.armorClass).toEqual(["Monk (PHB)"]);
    expect(gaps.roll).toEqual(["Steady (PHB)"]);
    expect(gaps.attack).toEqual(["Aimed (PHB)"]);
    expect(gaps.extraDamage).toEqual(["Smiting (PHB)"]);
    expect(gaps.martialArts).toEqual(["Fists (PHB)"]);
    expect(gaps.heal).toEqual(["Mending (PHB)"]);
    expect(gaps.tempHp).toEqual(["Shielding (PHB)"]);
    expect(gaps.unclassified).toEqual(["Lucky (PHB)", "Strider (PHB)", "Venom (PHB)"]);
    expect(countGaps(gaps)).toEqual({
      ...zero,
      defense: 1,
      sense: 1,
      bonus: 1,
      armorClass: 1,
      unarmoredBase: 1,
      roll: 1,
      attack: 1,
      extraDamage: 1,
      martialArts: 1,
      heal: 1,
      tempHp: 1,
      unclassified: 3,
    });
  });

  it("prints the count per kind, the features beneath it, and a rise past the baseline", () => {
    const lines = reportGaps(mechanicGaps(db), { defense: 1 });
    expect(lines).toContain("  defense 1");
    expect(lines).toContain("  sense 1 — up from 0");
    expect(lines).toContain("    Quick (XPHB)");
  });
});

describe("the baseline", () => {
  let file = "";
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mechanic-gaps-"));
    file = join(dir, "baseline.json");
    writeFileSync(file, JSON.stringify({ defense: 2, sense: 1 }));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("fails a kind whose count rose, a kind it lacks counting from zero", () => {
    expect(risen({ ...zero, defense: 3, sense: 1 }, readBaseline(file))).toEqual(["defense"]);
    expect(risen({ ...zero, defense: 2, speed: 1 }, readBaseline(file))).toEqual(["speed"]);
    expect(risen({ ...zero, defense: 1 }, readBaseline(file))).toEqual([]);
  });

  it("is lowered where a count fell and none rose, and left alone otherwise", () => {
    const before = readFileSync(file, "utf8");
    expect(lowerBaseline({ ...zero, defense: 3 }, file)).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(lowerBaseline({ ...zero, defense: 1, sense: 1 }, file)).toBe(true);
    expect(readBaseline(file)).toEqual({ ...zero, defense: 1, sense: 1 });
  });
});

describe.skipIf(!existsSync(join(VENDOR, "data/class")))("against vendor/", () => {
  let workspace = "";

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-gaps-"));
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("holds every kind at or under the committed baseline, and lowers it on a fall", () => {
    const contentDir = join(workspace, "data", "content");
    buildContent({ vendorDir: VENDOR, contentDir, loaders: [classes, characterOptions], meta: {} });
    const db = new Database(resolveContentDb(contentDir), { readonly: true });
    try {
      const counts = countGaps(mechanicGaps(db));
      // Record the feature's mechanics or narrative mark; `pnpm content:build` names each one.
      expect(risen(counts, readBaseline())).toEqual([]);
      lowerBaseline(counts);
    } finally {
      db.close();
    }
  });
});
