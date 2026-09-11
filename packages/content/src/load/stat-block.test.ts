import { describe, expect, it } from "vitest";
import type { Entry } from "./json.ts";
import { addSkills, modifySpells } from "./stat-block.ts";

const WHERE = "data/bestiary/bestiary-bgdia.json monster";

/**
 * The Archmage (MM), which seven of the bestiary's whole-entry mods copy. Its own
 * Arcana of +13 is the check on the arithmetic here: challenge rating 12 gives a
 * proficiency bonus of 4, Intelligence 20 a modifier of +5, and expertise doubles
 * the first — so a skill added at the same multiplier has to land on +13 too.
 */
const archmage = (): Entry => ({
  name: "Archmage",
  source: "MM",
  cr: "12",
  int: 20,
  wis: 15,
  skill: { arcana: "+13", history: "+13" },
  spellcasting: [
    {
      name: "Spellcasting",
      will: ["{@spell disguise self}"],
      spells: {
        "0": { spells: ["{@spell fire bolt}"] },
        "7": { slots: 1, spells: ["{@spell teleport}"] },
      },
    },
  ],
});

describe("addSkills", () => {
  it("doubles the proficiency bonus at a multiplier of two", () => {
    const entry = archmage();
    addSkills(entry, { mode: "addSkills", skills: { investigation: 2 } }, WHERE);

    expect(entry.skill).toEqual({ arcana: "+13", history: "+13", investigation: "+13" });
  });

  it("adds it once at a multiplier of one", () => {
    const entry = archmage();
    addSkills(entry, { mode: "addSkills", skills: { insight: 1, medicine: 1 } }, WHERE);

    expect(entry.skill).toMatchObject({ insight: "+6", medicine: "+6" });
  });

  /**
   * The Reghed Warrior (IDRotF) copies a Tribal Warrior, which has no skills at
   * all and a rating below 1 — where the bonus is the one a rating of 1 carries.
   */
  it("gives a creature with no skills one, at the floor of the rating curve", () => {
    const entry: Entry = { name: "Tribal Warrior", source: "MM", cr: "1/8", wis: 11 };
    addSkills(entry, { mode: "addSkills", skills: { survival: 1 } }, WHERE);

    expect(entry.skill).toEqual({ survival: "+2" });
  });

  it("signs a negative bonus rather than printing a bare number", () => {
    const entry: Entry = { name: "Ox", source: "MM", cr: "0", int: 2 };
    addSkills(entry, { mode: "addSkills", skills: { arcana: 0 } }, WHERE);

    expect(entry.skill).toEqual({ arcana: "-4" });
  });

  it("reads the plain rating when a lair changes it", () => {
    const entry: Entry = { name: "Hydra", source: "MM", cr: { cr: "8", lair: "9" }, wis: 10 };
    addSkills(entry, { mode: "addSkills", skills: { perception: 1 } }, WHERE);

    expect(entry.skill).toEqual({ perception: "+3" });
  });

  it("refuses a skill it cannot roll", () => {
    expect(() =>
      addSkills(archmage(), { mode: "addSkills", skills: { bartering: 1 } }, WHERE),
    ).toThrow('addSkills does not know "bartering"');
  });

  it("refuses a skill whose ability the creature does not carry", () => {
    const entry: Entry = { name: "Thing", source: "MM", cr: "1" };
    expect(() => addSkills(entry, { mode: "addSkills", skills: { athletics: 1 } }, WHERE)).toThrow(
      'addSkills reads str for "athletics", which is not a score',
    );
  });
});

describe("modifySpells", () => {
  const block = (entry: Entry): Entry => (entry.spellcasting as Entry[])[0] as Entry;

  it("appends to a spell level beside the slots it keeps", () => {
    const entry = archmage();
    modifySpells(
      entry,
      { spells: { "7": { spells: ["{@spell plane shift}"] } } },
      "addSpells",
      WHERE,
    );

    expect((block(entry).spells as Entry)["7"]).toEqual({
      slots: 1,
      spells: ["{@spell teleport}", "{@spell plane shift}"],
    });
  });

  it("appends to a list the block keeps outright", () => {
    const entry = archmage();
    modifySpells(entry, { will: ["{@spell polymorph} (self only)"] }, "addSpells", WHERE);

    expect(block(entry).will).toEqual(["{@spell disguise self}", "{@spell polymorph} (self only)"]);
  });

  it("creates a frequency the block does not have yet", () => {
    const entry = archmage();
    modifySpells(entry, { daily: { "1e": ["{@spell commune}"] } }, "addSpells", WHERE);

    expect(block(entry).daily).toEqual({ "1e": ["{@spell commune}"] });
  });

  it("swaps one spell for another at the level it names", () => {
    const entry = archmage();
    modifySpells(
      entry,
      { spells: { "7": [{ replace: "{@spell teleport}", with: "{@spell plane shift}" }] } },
      "replaceSpells",
      WHERE,
    );

    expect((block(entry).spells as Entry)["7"]).toEqual({
      slots: 1,
      spells: ["{@spell plane shift}"],
    });
  });

  it("removes the spells a frequency names", () => {
    const entry = archmage();
    block(entry).daily = { "3e": ["{@spell fear}", "{@spell wall of fire}"] };
    modifySpells(entry, { daily: { "3e": ["{@spell fear}"] } }, "removeSpells", WHERE);

    expect(block(entry).daily).toEqual({ "3e": ["{@spell wall of fire}"] });
  });

  /** The same reason `replaceArr` refuses one: a typo that does nothing reads as a working mod. */
  it("refuses a replacement the list does not hold", () => {
    expect(() =>
      modifySpells(
        archmage(),
        { spells: { "7": [{ replace: "{@spell wish}", with: "{@spell gate}" }] } },
        "replaceSpells",
        WHERE,
      ),
    ).toThrow("replaceSpells found no {@spell wish} in spells.7");
  });

  it("refuses a removal the list does not hold", () => {
    expect(() =>
      modifySpells(archmage(), { will: ["{@spell fly}"] }, "removeSpells", WHERE),
    ).toThrow("removeSpells names {@spell fly}, which will does not hold");
  });

  it("refuses a key it does not know rather than dropping the spells", () => {
    expect(() => modifySpells(archmage(), { hourly: {} }, "addSpells", WHERE)).toThrow(
      'addSpells does not know "hourly"',
    );
  });

  /** Choosing among several is a guess, and every entry in the corpus has one. */
  it("refuses a creature with more than one spellcasting block", () => {
    const entry = archmage();
    entry.spellcasting = [{ name: "Spellcasting" }, { name: "Innate Spellcasting" }];

    expect(() => modifySpells(entry, { will: ["x"] }, "addSpells", WHERE)).toThrow(
      "addSpells needs one spellcasting block, found 2",
    );
  });

  it("refuses a creature that casts nothing", () => {
    expect(() =>
      modifySpells({ name: "Ox", source: "MM" }, { will: ["x"] }, "addSpells", WHERE),
    ).toThrow("addSpells needs one spellcasting block, found 0");
  });
});
