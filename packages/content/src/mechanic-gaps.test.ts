import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildContent, resolveContentDb } from "./build-db.ts";
import { characterOptions } from "./load/character-options.ts";
import { classes } from "./load/classes.ts";
import { races } from "./load/races.ts";
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
  dc: 0,
  active: 0,
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
  pool: 0,
  convert: 0,
  slotRecovery: 0,
  regain: 0,
  poolCost: 0,
  turn: 0,
  spells: 0,
  triggered: 0,
  uses: 0,
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
  feat.run("Fortunate", "PHB", "classic", json({ srd: true }, "reroll a d20"));
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
  feat.run(
    "Relentlessly",
    "PHB",
    "classic",
    json({ srd: true }, "when you roll initiative and have none left, you regain one"),
  );
  feat.run(
    "Relentlessly",
    "XPHB",
    "one",
    json({ srd52: true }, "when you roll initiative and have none left, you regain one"),
  );
  feat.run("Mending", "PHB", "classic", json({ srd: true }, "regain {@dice 1d10} hit points"));
  feat.run("Shielding", "PHB", "classic", json({ srd: true }, "gain 5 temporary hit points"));
  feat.run(
    "Superior",
    "PHB",
    "classic",
    json({ srd: true }, "You have four superiority dice, which are {@dice d8}s."),
  );
  const flexible = json({ srd: true }, "expend one spell slot to gain sorcery points");
  feat.run("Flexible", "PHB", "classic", flexible);
  feat.run(
    "Fountain",
    "XPHB",
    "one",
    json({ srd52: true }, "transform points into one spell slot"),
  );
  feat.run(
    "Recovering",
    "PHB",
    "classic",
    json({ srd: true }, "choose expended spell slots to recover"),
  );
  feat.run(
    "Recovered",
    "XPHB",
    "one",
    json({ srd52: true }, "choose expended spell slots to recover"),
  );
  feat.run(
    "Restoring",
    "PHB",
    "classic",
    json({ srd: true }, "you regain 4 expended sorcery points whenever you finish a short rest"),
  );
  feat.run(
    "Restored",
    "XPHB",
    "one",
    json({ srd52: true }, "you regain 4 expended sorcery points whenever you finish a short rest"),
  );
  const surging = json({ srd: true }, "a number of times equal to your Charisma modifier");
  feat.run("Surging", "PHB", "classic", surging);
  db.prepare(
    "INSERT INTO feats (name, source, edition, json, uses, uses_reset) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("Counted", "PHB", "classic", surging, 2, "long");
  db.prepare(
    "INSERT INTO class_features (name, source, class_name, class_source, level, edition, json) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("Flurry of Blows", "PHB", "Monk", "PHB", 2, "classic", surging);
  feat.run("Spender", "PHB", "classic", json({ srd: true }, "you can spend 2 ki points to strike"));
  feat.run(
    "Frightening",
    "PHB",
    "classic",
    json(
      { srd: true },
      "a Wisdom saving throw ({@dc 8} + your proficiency bonus + your Charisma modifier)",
    ),
  );
  feat.run(
    "Withering",
    "XPHB",
    "one",
    json(
      { srd52: true },
      "a Wisdom saving throw ({@dc 8} + your proficiency bonus + your Charisma modifier)",
    ),
  );
  feat.run(
    "Stunning Strike",
    "PHB",
    "classic",
    json({ srd: true, consumes: { name: "Ki", amount: 1 } }, "stun the target"),
  );
  feat.run(
    "Winged",
    "PHB",
    "classic",
    json({ srd: true }, "For the duration, you have a fly speed"),
  );
  feat.run("Turning", "PHB", "classic", json({ srd: true }, "it is turned for 1 minute"));
  feat.run(
    "Twice",
    "PHB",
    "classic",
    json({ srd: true }, "you can attack twice whenever you take the {@action Attack} action"),
  );
  feat.run(
    "Nimble",
    "PHB",
    "classic",
    json({ srd: true }, "you can take the {@action Dash} action as a bonus action"),
  );

  feat.run(
    "Gifted",
    "PHB",
    "classic",
    JSON.stringify({ srd: true, additionalSpells: [{ innate: { _: ["mage armor"] } }] }),
  );
  feat.run(
    "Arcane",
    "PHB",
    "classic",
    json({ srd: true }, "you can cast {@spell fly} once without expending a spell slot"),
  );

  it("names an in-scope feature with no record under each kind its text suggests, per source", () => {
    const { PHB: phb, XPHB: xphb, XGE: xge } = mechanicGaps(db);
    expect(phb?.defense).toEqual(["Hardy (PHB), Fighter level 3"]);
    expect(phb?.sense).toEqual(["Hardy (PHB), Fighter level 3"]);
    expect(phb?.unarmoredBase).toEqual(["Monk (PHB)"]);
    expect(phb?.armorClass).toEqual(["Monk (PHB)"]);
    expect(phb?.roll).toEqual(["Steady (PHB)"]);
    expect(phb?.attack).toEqual(["Aimed (PHB)"]);
    expect(phb?.extraDamage).toEqual(["Smiting (PHB)"]);
    expect(phb?.martialArts).toEqual(["Fists (PHB)"]);
    expect(phb?.heal).toEqual(["Mending (PHB)"]);
    expect(phb?.tempHp).toEqual(["Shielding (PHB)"]);
    expect(phb?.pool).toEqual(["Superior (PHB)"]);
    expect(phb?.convert).toEqual(["Flexible (PHB)"]);
    expect(phb?.slotRecovery).toEqual(["Recovering (PHB)"]);
    expect(phb?.regain).toEqual(["Restoring (PHB)"]);
    expect(phb?.triggered).toEqual(["Relentlessly (PHB)"]);
    expect(xphb?.triggered).toEqual([]);
    expect(phb?.uses).toEqual(["Surging (PHB)"]);
    expect(phb?.poolCost).toEqual(["Spender (PHB)"]);
    expect(phb?.dc).toEqual(["Frightening (PHB)"]);
    expect(phb?.active).toEqual(["Winged (PHB)"]);
    expect(phb?.turn).toEqual(["Nimble (PHB)", "Twice (PHB)"]);
    expect(phb?.spells).toEqual(["Arcane (PHB)", "Gifted (PHB)"]);
    expect(phb?.unclassified).toEqual([
      "Counted (PHB)",
      "Flurry of Blows (PHB), Monk level 2",
      "Fortunate (PHB)",
      "Strider (PHB)",
      "Stunning Strike (PHB)",
      "Turning (PHB)",
      "Venom (PHB)",
    ]);
    expect(xphb?.bonus).toEqual(["Quick (XPHB)", "Relentlessly (XPHB)"]);
    expect(xphb?.unclassified).toEqual([
      "Fountain (XPHB)",
      "Recovered (XPHB)",
      "Restored (XPHB)",
      "Withering (XPHB)",
    ]);
    expect(xge?.bonus).toEqual(["Wary (XGE)"]);
    expect(xge?.sense).toEqual([]);
  });

  it("counts each source on its own", () => {
    const counts = countGaps(mechanicGaps(db));
    expect(Object.keys(counts)).toEqual(["PHB", "XGE", "XPHB"]);
    expect(counts.PHB).toMatchObject({
      defense: 1,
      triggered: 1,
      turn: 2,
      spells: 2,
      unclassified: 7,
    });
    expect(counts.XGE).toEqual({ ...zero, bonus: 1 });
    expect(counts.XPHB).toEqual({ ...zero, bonus: 2, unclassified: 4 });
  });

  it("prints the count per kind, the features beneath it, and a rise past the baseline", () => {
    const lines = reportGaps(mechanicGaps(db), { PHB: { defense: 1 } });
    expect(lines).toContain("  defense 1");
    expect(lines).toContain("  sense 1 — up from 0");
    expect(lines).toContain("    Quick (XPHB)");
    expect(lines).toContain("XGE");
  });
});

describe("race, subrace and background traits", () => {
  const db = new Database(":memory:");
  db.exec(CONTENT_SCHEMA);
  const trait = (name: string, text: string) => ({ name, type: "entries", entries: [text] });
  const age = trait("Age", "You live long.");
  const languages = trait("Languages", "You speak Common.");
  const darkvision = trait("Darkvision", "You have darkvision out to 60 feet.");
  const toughness = trait("Dwarven Toughness", "Your hit point maximum increases by 1.");
  const sturdy = trait("Sturdy", "You have resistance to poison damage.");
  const race = db.prepare(
    "INSERT INTO races (name, source, edition, json, trait_uses) VALUES (?, ?, ?, ?, ?)",
  );
  race.run(
    "Dwarf",
    "PHB",
    "classic",
    JSON.stringify({ entries: [age, languages, darkvision, sturdy] }),
    null,
  );
  race.run(
    "Gnome",
    "PHB",
    "classic",
    JSON.stringify({ entries: [trait("Gnome Cunning", "You have advantage on saves")] }),
    null,
  );
  race.run(
    "Kobold",
    "MPMM",
    "classic",
    JSON.stringify({
      entries: [
        trait("Grovel", "You can do so a number of times equal to your proficiency bonus."),
        trait("Wriggle", "You can do so a number of times equal to your proficiency bonus."),
      ],
    }),
    '{"Grovel":{"uses":1,"reset":"long"}}',
  );
  race.run("Elf", "XPHB", "one", JSON.stringify({ entries: [darkvision] }), null);
  const subrace = db.prepare(
    "INSERT INTO subraces (name, full_name, source, race_name, race_source, edition, json) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  subrace.run(
    "Hill",
    "Dwarf (Hill)",
    "PHB",
    "Dwarf",
    "PHB",
    "classic",
    JSON.stringify({ entries: [age, darkvision, sturdy, toughness] }),
  );
  subrace.run(
    "Mountain",
    "Dwarf (Mountain)",
    "PHB",
    "Dwarf",
    "PHB",
    "classic",
    JSON.stringify({ entries: [age, darkvision, trait("Sturdy", "Changed, with darkvision.")] }),
  );
  db.prepare("INSERT INTO backgrounds (name, source, edition, json) VALUES (?, ?, ?, ?)").run(
    "Acolyte",
    "PHB",
    "classic",
    JSON.stringify({
      entries: [
        trait("Suggested Characteristics", "You are devout."),
        trait("Feature: Shelter", "You have advantage on darkvision."),
      ],
    }),
  );

  it("counts each trait of a race on its own, leaving out what only describes it", () => {
    const gaps = mechanicGaps(db);
    expect(gaps.PHB?.sense).toEqual([
      "Darkvision (PHB), Dwarf",
      "Shelter (PHB), Acolyte",
      "Sturdy (PHB), Dwarf (Mountain)",
    ]);
    expect(gaps.PHB?.defense).toEqual(["Sturdy (PHB), Dwarf"]);
    expect(gaps.PHB?.unclassified).not.toContain("Languages (PHB), Dwarf");
    expect(gaps.XPHB).toBeUndefined();
  });

  it("counts a subrace's traits only where it adds or changes them", () => {
    const labels = Object.values(mechanicGaps(db).PHB ?? {}).flat();
    expect(labels.filter((label) => label.endsWith("Dwarf (Hill)"))).toEqual([]);
    expect(labels).toContain("Sturdy (PHB), Dwarf (Mountain)");
    expect(labels).not.toContain("Age (PHB), Dwarf (Mountain)");
  });

  it("leaves off a trait its race records, and a trait whose uses the build counted", () => {
    const gaps = mechanicGaps(db);
    expect(Object.values(gaps.PHB ?? {}).flat()).not.toContain("Gnome Cunning (PHB), Gnome");
    expect(Object.values(gaps.PHB ?? {}).flat()).not.toContain(
      "Dwarven Toughness (PHB), Dwarf (Hill)",
    );
    expect(gaps.MPMM?.uses).toEqual(["Wriggle (MPMM), Kobold"]);
  });
});

describe("the baseline", () => {
  let file = "";
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mechanic-gaps-"));
    file = join(dir, "baseline.json");
    writeFileSync(file, JSON.stringify({ PHB: { defense: 2, sense: 1 }, TCE: { defense: 1 } }));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("fails a kind whose count rose in a source, a kind or source it lacks counting from zero", () => {
    const counts = (phb: Partial<Counts>, tce: Partial<Counts> = {}) => ({
      PHB: { ...zero, ...phb },
      TCE: { ...zero, defense: 1, ...tce },
    });
    expect(risen(counts({ defense: 3, sense: 1 }), readBaseline(file))).toEqual(["PHB defense"]);
    expect(risen(counts({ defense: 2 }, { speed: 1 }), readBaseline(file))).toEqual(["TCE speed"]);
    expect(
      risen({ ...counts({ defense: 1 }), XGE: { ...zero, sense: 1 } }, readBaseline(file)),
    ).toEqual(["XGE sense"]);
    expect(risen(counts({ defense: 1 }), readBaseline(file))).toEqual([]);
  });

  it("is lowered where a count fell and none rose, and left alone otherwise", () => {
    const before = readFileSync(file, "utf8");
    const tce = { ...zero, defense: 1 };
    expect(lowerBaseline({ PHB: { ...zero, defense: 3 }, TCE: tce }, file)).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(lowerBaseline({ PHB: { ...zero, defense: 2, sense: 1 }, TCE: tce }, file)).toBe(false);
    expect(lowerBaseline({ PHB: { ...zero, defense: 1, sense: 1 }, TCE: zero }, file)).toBe(true);
    expect(readBaseline(file)).toEqual({ PHB: { ...zero, defense: 1, sense: 1 } });
  });
});

describe.skipIf(!existsSync(join(VENDOR, "data/class")))("against vendor/", () => {
  let workspace = "";

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-gaps-"));
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("holds every source's every kind at or under the committed baseline, and lowers it on a fall", () => {
    const contentDir = join(workspace, "data", "content");
    buildContent({
      vendorDir: VENDOR,
      contentDir,
      loaders: [classes, characterOptions, races],
      meta: {},
    });
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
