import { describe, expect, it } from "vitest";
import { parseTags, renderText, type Token } from "./index.ts";

/** The whole point of every token carrying display text. */
const shown = (input: string) => renderText(parseTags(input));

const only = (input: string): Token => {
  const tokens = parseTags(input);
  expect(tokens).toHaveLength(1);
  const [token] = tokens;
  if (token === undefined) throw new Error("unreachable");
  return token;
};

describe("grammar", () => {
  it("keeps untagged text as one token", () => {
    expect(parseTags("plain prose")).toEqual([{ kind: "text", value: "plain prose" }]);
  });

  it("parses a bare tag that takes no arguments", () => {
    expect(only("{@h}")).toEqual({ kind: "text", value: "Hit: " });
  });

  it("parses the display-only form", () => {
    expect(only("{@spell fireball}")).toEqual({
      kind: "ref",
      tag: "spell",
      name: "fireball",
      display: "fireball",
    });
  });

  it("parses the piped form", () => {
    expect(only("{@item chain mail|phb}")).toEqual({
      kind: "ref",
      tag: "item",
      name: "chain mail",
      source: "phb",
      display: "chain mail",
    });
  });

  it("treats an empty argument as absent rather than as an empty string", () => {
    expect(only("{@creature Riding Horse||Horse}")).toEqual({
      kind: "ref",
      tag: "creature",
      name: "Riding Horse",
      display: "Horse",
    });
  });

  it("falls back to the name when the display argument is empty", () => {
    expect(only("{@skill Animal Handling|XPHB|}")).toEqual({
      kind: "ref",
      tag: "skill",
      name: "Animal Handling",
      source: "XPHB",
      display: "Animal Handling",
    });
  });

  it("ignores trailing arguments a tag does not use", () => {
    expect(only("{@item armor of resistance||Chain mail of resistance|}")).toEqual({
      kind: "ref",
      tag: "item",
      name: "armor of resistance",
      display: "Chain mail of resistance",
    });
  });

  it("splits text around a tag", () => {
    expect(parseTags("Deals {@damage 8d6} fire damage.")).toEqual([
      { kind: "text", value: "Deals " },
      { kind: "roll", notation: "8d6", display: "8d6", rollable: true },
      { kind: "text", value: " fire damage." },
    ]);
  });

  it("leaves unbalanced markup literal", () => {
    expect(shown("a {@spell fireball")).toBe("a {@spell fireball");
  });

  it("confines a malformed tag to itself and keeps parsing after it", () => {
    expect(shown("ok {@spell fireball} then {@i broken { and {@item rope}")).toBe(
      "ok fireball then {@i broken { and rope",
    );
  });

  it("emits nothing for a style tag with no content", () => {
    expect(parseTags("a {@i} b")).toEqual([
      { kind: "text", value: "a " },
      { kind: "text", value: " b" },
    ]);
  });
});

describe("nesting", () => {
  it("nests a tag inside a style tag", () => {
    expect(only("{@i {@spell fireball}}")).toEqual({
      kind: "style",
      style: "italic",
      children: [{ kind: "ref", tag: "spell", name: "fireball", display: "fireball" }],
    });
  });

  it("nests a style tag inside a style tag", () => {
    expect(shown("{@i {@b An adventure for Level 9 characters.}}")).toBe(
      "An adventure for Level 9 characters.",
    );
  });

  it("flattens a tag nested in a computed display", () => {
    expect(only("{@hit +3|{@hit 3} to hit}")).toEqual({
      kind: "roll",
      notation: "1d20+3",
      display: "+3 to hit",
      rollable: true,
    });
  });

  it("does not split on a pipe inside a nested tag", () => {
    const token = only("{@i {@item longbow|XPHB|long}}");
    expect(renderText([token])).toBe("long");
  });
});

describe("degradation", () => {
  it("degrades an unknown tag to its display text", () => {
    expect(only("{@totallynewtag some words}")).toEqual({
      kind: "text",
      value: "some words",
    });
  });

  it("degrades an unknown piped tag to its first argument", () => {
    expect(shown("{@newtag Blade of Woe|XDMG|whatever}")).toBe("Blade of Woe");
  });

  it("emits no token for an unknown tag that has no arguments", () => {
    expect(parseTags("a {@unknowable} b")).toEqual([
      { kind: "text", value: "a " },
      { kind: "text", value: " b" },
    ]);
  });

  it("never throws on any tag name", () => {
    for (const input of ["{@}", "{@ }", "{@x}", "{@x|}", "{@x||||}", "{@i}", "{@dice}"]) {
      expect(() => parseTags(input)).not.toThrow();
    }
  });

  it("degrades {@filter} to text, since the list page does not exist here", () => {
    expect(only("{@filter demons|bestiary|source=GGR|tag=demon}")).toEqual({
      kind: "text",
      value: "demons",
    });
  });
});

describe("rolls", () => {
  it("marks plain notation rollable", () => {
    expect(only("{@dice 1d4 + 4}")).toEqual({
      kind: "roll",
      notation: "1d4 + 4",
      display: "1d4 + 4",
      rollable: true,
    });
  });

  it("marks notation it cannot read unrollable rather than guessing", () => {
    expect(only("{@damage (summonSpellLevel - 4)d4 + 3|1d4 + 3}")).toEqual({
      kind: "roll",
      notation: "(summonSpellLevel - 4)d4 + 3",
      display: "1d4 + 3",
      rollable: false,
    });
  });

  it("synthesizes the d20 notation for an attack bonus", () => {
    expect(only("{@hit 5}")).toEqual({
      kind: "roll",
      notation: "1d20+5",
      display: "+5",
      rollable: true,
    });
  });

  it("keeps a negative attack bonus signed once", () => {
    expect(only("{@hit -1}")).toEqual({
      kind: "roll",
      notation: "1d20-1",
      display: "-1",
      rollable: true,
    });
  });

  it("makes a plain d20 bonus rollable", () => {
    expect(only("{@d20 3}")).toEqual({
      kind: "roll",
      notation: "1d20+3",
      display: "+3",
      rollable: true,
    });
  });

  it("prefers the display a scaling dice tag names for itself", () => {
    expect(only("{@scaledice 2d6|1,3,5,7,9|1d6|psi|extra amount}")).toEqual({
      kind: "roll",
      notation: "1d6",
      display: "extra amount",
      rollable: true,
    });
  });

  it("emits nothing for a d20 tag with no bonus", () => {
    expect(parseTags("a {@hit} b")).toEqual([
      { kind: "text", value: "a " },
      { kind: "text", value: " b" },
    ]);
  });

  it("reads the per-level dice out of a scaling dice tag", () => {
    expect(only("{@scaledice 8d6|3-9|1d6}")).toEqual({
      kind: "roll",
      notation: "1d6",
      display: "1d6",
      rollable: true,
    });
  });

  it("reads the current tier out of a scaling damage tag", () => {
    expect(only("{@scaledamage 2d6;3d6|2-9|1d6}")).toEqual({
      kind: "roll",
      notation: "1d6",
      display: "1d6",
      rollable: true,
    });
  });

  it("reads the bonus out of a skill check", () => {
    expect(only("{@skillCheck survival 4}")).toEqual({
      kind: "roll",
      notation: "1d20+4",
      display: "+4",
      rollable: true,
    });
  });

  it("defers to @dnd/dice on what is rollable", () => {
    expect(only("{@dice 4d6kh9}")).toMatchObject({ rollable: false });
    expect(only("{@dice 4d6kh3}")).toMatchObject({ rollable: true });
    expect(only("{@dice 5000d6}")).toMatchObject({ rollable: false });
  });

  it("leaves a save DC as text, because a target number is not rolled", () => {
    expect(only("{@dc 15}")).toEqual({ kind: "text", value: "DC 15" });
  });
});

describe("tags whose display is derived", () => {
  it.each([
    ["{@atk mw}", "Melee Weapon Attack:"],
    ["{@atk rs}", "Ranged Spell Attack:"],
    ["{@atk mw,rw}", "Melee or Ranged Weapon Attack:"],
    ["{@atk ms,rs}", "Melee or Ranged Spell Attack:"],
    ["{@atkr m}", "Melee Attack Roll:"],
    ["{@atkr m,r}", "Melee or Ranged Attack Roll:"],
    ["{@atk zz}", "Attack:"],
    ["{@recharge}", "(Recharge 6)"],
    ["{@recharge 5}", "(Recharge 5–6)"],
    ["{@recharge 5|m}", "Recharge 5–6"],
    ["{@m}", "Miss: "],
    ["{@actSaveFailBy 5}", "Failure by 5 or More:"],
    ["{@actSaveFail 3}", "Third Failure:"],
    ["{@actSaveFail 9}", "Failure 9:"],
    ["{@ability str  18}", "+4"],
    ["{@ability str}", "str"],
    ["{@atk MW}", "Melee Weapon Attack:"],
    ["{@actSave dex}", "Dexterity Saving Throw:"],
    ["{@actSaveFail}", "Failure:"],
    ["{@actSaveSuccess}", "Success:"],
    ["{@chance 10}", "10 percent"],
    ["{@actSaveSuccessOrFail}", "Failure or Success:"],
    ["{@actTrigger}", "Trigger:"],
    ["{@actResponse}", "Response:"],
    ["{@hom}", "Hit or Miss: "],
    ["{@actSaveFail 1}", "First Failure:"],
    ["{@actSaveFail 2}", "Second Failure:"],
    ["{@actResponse d}", "Response—"],
    ["{@italic Ioun stone}", "Ioun stone"],
    ["{@ability str 18|+4}", "+4"],
    ["{@ability con 8}", "-1"],
    ["{@ability str 20}", "+5"],
    ["{@savingThrow con 3}", "+3"],
    ["{@d20 3}", "+3"],
    ["{@d20 +9}", "+9"],
    ["{@bold Limp.}", "Limp."],
    ["{@chance 50|display text}", "display text"],
    ["{@quickref Cover||3||three-quarters cover}", "three-quarters cover"],
    ["{@quickref difficult terrain||3}", "difficult terrain"],
  ])("renders %s as %s", (input, expected) => {
    expect(shown(input)).toBe(expected);
  });
});

describe("argument positions that are not name|source|display", () => {
  it("skips the deck a card sits in", () => {
    expect(only("{@card Ghost|Tarokka Deck|RHW}")).toEqual({
      kind: "ref",
      tag: "card",
      name: "Ghost",
      source: "RHW",
      display: "Ghost",
    });
  });

  it("reads a card display from the fourth argument", () => {
    expect(only("{@card Mithral Chain Mail|Magic Item Cards|DIP|card}")).toEqual({
      kind: "ref",
      tag: "card",
      name: "Mithral Chain Mail",
      source: "DIP",
      display: "card",
    });
  });

  it("skips the pantheon a deity belongs to", () => {
    expect(only("{@deity Umberlee|Faerûnian|SCAG}")).toEqual({
      kind: "ref",
      tag: "deity",
      name: "Umberlee",
      source: "SCAG",
      display: "Umberlee",
    });
  });

  it("reads a deity display from the fourth argument", () => {
    expect(only("{@deity Corellon Larethian|Elven|MTF|Corellon}")).toEqual({
      kind: "ref",
      tag: "deity",
      name: "Corellon Larethian",
      source: "MTF",
      display: "Corellon",
    });
  });

  it("takes the subclass source, not the class source", () => {
    expect(only("{@subclass Ancestral Guardian|Barbarian||XGE}")).toEqual({
      kind: "ref",
      tag: "subclass",
      name: "Ancestral Guardian",
      source: "XGE",
      display: "Ancestral Guardian",
    });
  });

  it("falls back to the class source when a class feature omits its own", () => {
    expect(only("{@classFeature Innate Sorcery|Sorcerer|XPHB|1}")).toEqual({
      kind: "ref",
      tag: "classFeature",
      name: "Innate Sorcery",
      source: "XPHB",
      display: "Innate Sorcery",
    });
  });

  it("falls back to the subclass source before the class source", () => {
    expect(only("{@subclassFeature Form of Dread|Warlock|XPHB|Undead|RHW|3}")).toEqual({
      kind: "ref",
      tag: "subclassFeature",
      name: "Form of Dread",
      source: "RHW",
      display: "Form of Dread",
    });
  });

  it("reads the display of a class feature from the sixth argument", () => {
    expect(only("{@classFeature Rage|Barbarian||1||optional display text}")).toEqual({
      kind: "ref",
      tag: "classFeature",
      name: "Rage",
      display: "optional display text",
    });
  });

  it("reads the display of a subclass feature from the eighth argument", () => {
    expect(
      only("{@subclassFeature Path of the Berserker|Barbarian||Berserker||3||display}"),
    ).toEqual({
      kind: "ref",
      tag: "subclassFeature",
      name: "Path of the Berserker",
      display: "display",
    });
  });

  it("keeps the source of a class feature out of the class name", () => {
    expect(only("{@classFeature Primal Knowledge|Barbarian||3|TCE}")).toEqual({
      kind: "ref",
      tag: "classFeature",
      name: "Primal Knowledge",
      source: "TCE",
      display: "Primal Knowledge",
    });
  });
});

/**
 * Copied verbatim from `vendor/5etools/data/`. Invented cases miss the nesting and the
 * argument shapes that upstream actually writes.
 */
describe("tags that name something other than their first argument", () => {
  it("names the subclass when a class tag carries one", () => {
    expect(only("{@class Barbarian|XPHB|Path of the Berserker|Berserker|XPHB}")).toEqual({
      kind: "ref",
      tag: "subclass",
      name: "Berserker",
      source: "XPHB",
      display: "Path of the Berserker",
    });
  });

  it("names the class when it does not", () => {
    expect(only("{@class Cleric|XPHB}")).toEqual({
      kind: "ref",
      tag: "class",
      name: "Cleric",
      source: "XPHB",
      display: "Cleric",
    });
  });

  it.each([
    ["{@object ballista||ballistae}", "ballistae"],
    ["{@trap pits||spiked pit}", "spiked pit"],
    ["{@cult Cult of Asmodeus}", "Cult of Asmodeus"],
    ["{@charoption Echoing Soul|VRGR}", "Echoing Soul"],
    ["{@vehupgrade Arcane Artillery|GoS}", "Arcane Artillery"],
  ])("renders the catalog entity %s as %s", (input, expected) => {
    expect(shown(input)).toBe(expected);
  });

  it("keeps the text of an unknown tag whose first argument is empty", () => {
    expect(shown("{@homebrew |removals}")).toBe("removals");
  });

  it("keeps the text of a known tag whose first argument is empty", () => {
    expect(shown("Grants {@item |a mysterious shield} to the wielder.")).toBe(
      "Grants a mysterious shield to the wielder.",
    );
  });

  it("flattens nesting in a display a computed tag builds", () => {
    expect(only("{@class Barbarian|XPHB|{@i Path of the Berserker}|Berserker|XPHB}")).toEqual({
      kind: "ref",
      tag: "subclass",
      name: "Berserker",
      source: "XPHB",
      display: "Path of the Berserker",
    });
  });

  it("never throws, however deeply nested", () => {
    const deep = `${"{@i ".repeat(5000)}x${"}".repeat(5000)}`;
    expect(() => parseTags(deep)).not.toThrow();
  });

  it("stays linear on a string of unmatched tag openings", () => {
    const started = performance.now();
    parseTags("{@".repeat(64000));
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("real strings from the corpus", () => {
  it.each([
    [
      "{@atk mw} bonus to hit equal to this creature's proficiency bonus plus its Strength modifier, reach 5 ft., one target. {@h}{@damage 1d4} + this creature's Strength modifier piercing damage.",
      "Melee Weapon Attack: bonus to hit equal to this creature's proficiency bonus plus its Strength modifier, reach 5 ft., one target. Hit: 1d4 + this creature's Strength modifier piercing damage.",
    ],
    [
      "Each extended claw makes the following melee weapon attack: {@hit 8} to hit, reach 5 ft., one target. {@h} The target is {@condition grappled} (escape {@dc 15}).",
      "Each extended claw makes the following melee weapon attack: +8 to hit, reach 5 ft., one target. Hit:  The target is grappled (escape DC 15).",
    ],
    [
      "{@note * This generic variant has the same name and source as the item {@item +1 Shield|XDMG}}.",
      "* This generic variant has the same name and source as the item +1 Shield.",
    ],
    [
      "{@note Note: According to the SRD, it is an extra {@damage 3d6} necrotic damage, although {@link this is incorrect|https://rpg.stackexchange.com/a/174522/53884}.}",
      "Note: According to the SRD, it is an extra 3d6 necrotic damage, although this is incorrect.",
    ],
    [
      "While you are focused on this discipline, the area in a 5 foot radius around you is {@quickref difficult terrain||3} for any enemy that isn't immune to being {@condition frightened}.",
      "While you are focused on this discipline, the area in a 5 foot radius around you is difficult terrain for any enemy that isn't immune to being frightened.",
    ],
    [
      "A {@filter rare or rarer magic rod, staff, or wand|items|source=|type=rod;wand;staff|rarity=rare;very rare;legendary;artifact|category=} appears in your hands. The DM chooses the item.",
      "A rare or rarer magic rod, staff, or wand appears in your hands. The DM chooses the item.",
    ],
    [
      "{@note Created by the {@subclassFeature Eldritch Cannon|Artificer|EFA|Artillerist|EFA|3} subclass feature.}",
      "Created by the Eldritch Cannon subclass feature.",
    ],
    [
      "{@actTrigger} A creature the goblin can see hits it with an attack roll. {@actResponse d}{@actSave wis} {@dc 13}, the triggering creature. {@actSaveFail} The attack misses instead.",
      "Trigger: A creature the goblin can see hits it with an attack roll. Response—Wisdom Saving Throw: DC 13, the triggering creature. Failure: The attack misses instead.",
    ],
    [
      "Acidic Bile Sprayer (Requires 1 Crew and Grants Half Cover, {@recharge 5|m})",
      "Acidic Bile Sprayer (Requires 1 Crew and Grants Half Cover, Recharge 5–6)",
    ],
    ["{@creatureFluff Rusted|FRAiF|Other Rusted}", "Other Rusted"],
    [
      "{@ability con 12|+1} on checks, {@savingThrow con 3} on saving throws",
      "+1 on checks, +3 on saving throws",
    ],
    [
      "{@creature Tribal warrior} with {@skill Survival} {@skillCheck survival 4}; speaks Common",
      "Tribal warrior with Survival +4; speaks Common",
    ],
    [
      "When you cast this spell using a spell slot of 4th level or higher, the damage increases by {@scaledice 8d6|3-9|1d6} for each slot level above 3rd.",
      "When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
    ],
    [
      "Horn of Valhalla ({@item Horn of Valhalla, Silver||Silver|} or {@item Horn of Valhalla, Brass||Brass|})",
      "Horn of Valhalla (Silver or Brass)",
    ],
  ])("renders to plain text: %s", (input, expected) => {
    expect(shown(input)).toBe(expected);
  });

  it("keeps the reference in a real string resolvable later", () => {
    const tokens = parseTags("See {@item chain mail|phb} and {@spell fireball}.");
    expect(tokens.filter((token) => token.kind === "ref")).toEqual([
      { kind: "ref", tag: "item", name: "chain mail", source: "phb", display: "chain mail" },
      { kind: "ref", tag: "spell", name: "fireball", display: "fireball" },
    ]);
  });
});
