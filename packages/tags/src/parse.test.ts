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

  it("reads the current tier out of a scaling damage tag", () => {
    expect(only("{@scaledamage 2d6;3d6|2-9|1d6}")).toEqual({
      kind: "roll",
      notation: "1d6",
      display: "1d6",
      rollable: true,
    });
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
    ["{@atk zz}", "zz"],
    ["{@recharge}", "(Recharge 6)"],
    ["{@recharge 5}", "(Recharge 5–6)"],
    ["{@actSave dex}", "Dexterity Saving Throw:"],
    ["{@actSaveFail}", "Failure:"],
    ["{@actSaveSuccess}", "Success:"],
    ["{@chance 10}", "10 percent"],
    ["{@chance 50|display text}", "display text"],
    ["{@quickref Cover||3||three-quarters cover}", "three-quarters cover"],
    ["{@quickref difficult terrain||3}", "difficult terrain"],
  ])("renders %s as %s", (input, expected) => {
    expect(shown(input)).toBe(expected);
  });
});

describe("argument positions that are not name|source|display", () => {
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
