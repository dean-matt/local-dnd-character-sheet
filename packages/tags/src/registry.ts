/**
 * What upstream's markup means, per tag: where each one keeps its display text and its
 * source, and the English a tag with no display argument stands for.
 *
 * Adding support for a tag is a line here and no change to the parser. A tag absent
 * from this table degrades to its first argument rather than failing.
 */

import { isRollable } from "@dnd/dice";
import { abilityModifier } from "@dnd/rules";
import { arg, d20, type RefToken, type Spec, type Token, text } from "./token.ts";

const ABILITY_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const ATTACK_RANGE: Record<string, string> = { m: "Melee", r: "Ranged", a: "Area" };
const ATTACK_MEANS: Record<string, string> = { w: "Weapon", s: "Spell" };

/** A numbered failure escalates, so collapsing them loses which effect applies when. */
const FAILURE_ORDER: Record<string, string> = { "1": "First", "2": "Second", "3": "Third" };

/**
 * `{@atk mw,rw}` reads "Melee or Ranged Weapon Attack:" rather than repeating the
 * means, so a means shared by every code is factored out of the list.
 */
function attack(args: string[], suffix: string): Token {
  const raw = arg(args, 0) ?? "";
  // An unrecognized code such as `g` means nothing to a reader, but deleting the label
  // leaves the sentence claiming something it did not. The suffix alone still reads.
  const codes = raw
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code !== "");

  const parts: { range: string; means: string }[] = [];
  for (const code of codes) {
    const range = ATTACK_RANGE[code.slice(0, 1).toLowerCase()];
    const means = code.length > 1 ? ATTACK_MEANS[code.slice(1).toLowerCase()] : "";
    // Skip a code this does not know rather than discard the ones it does. Upstream
    // adds codes, and losing "Melee Weapon" to an unfamiliar sibling is the worse half.
    if (range === undefined || means === undefined) continue;
    parts.push({ range, means });
  }

  const first = parts[0];
  if (first === undefined) return text(suffix.trim());

  const ranges = parts.map((part) => part.range).join(" or ");
  const phrase = parts.every((part) => part.means === first.means)
    ? `${ranges}${first.means === "" ? "" : ` ${first.means}`}`
    : parts.map((part) => `${part.range} ${part.means}`.trim()).join(" or ");
  return text(`${phrase}${suffix}`);
}

/**
 * `{@class Barbarian|XPHB|Path of the Berserker|Berserker|XPHB}` displays a subclass,
 * and 500 of 1,054 occurrences do. The reference has to name what it displays, or it
 * resolves to the class and the link goes to the wrong page.
 */
function classRef(args: string[]): Token {
  const subclass = arg(args, 3);
  const display = arg(args, 2) ?? arg(args, 0) ?? arg(args, 1) ?? "";
  // Computed tags never reach the nameless-ref guard in the parser, so it repeats here.
  if (arg(args, 0) === undefined && subclass === undefined) return text(display);
  const token: RefToken =
    subclass === undefined
      ? { kind: "ref", tag: "class", name: arg(args, 0) ?? "", display }
      : { kind: "ref", tag: "subclass", name: subclass, display };
  const source = subclass === undefined ? arg(args, 1) : (arg(args, 4) ?? arg(args, 1));
  if (source !== undefined) token.source = source;
  return token;
}

/**
 * `{@scaledice 2d6|1,3,5,7,9|1d6|psi|extra amount}` names its own display in the fifth
 * argument, where `{@scaledamage}` only ever carries `psi` there.
 */
function scaledice(args: string[]): Token {
  const notation = arg(args, 2) ?? arg(args, 0) ?? "";
  return {
    kind: "roll",
    notation,
    display: arg(args, 4) ?? notation,
    rollable: isRollable(notation),
  };
}

/**
 * Shared by the d20 family. With no bonus there is nothing to roll, but a display the
 * tag supplied is still words, and dropping them is the failure `firstFilled` exists to
 * prevent on the other path.
 */
function d20Tag(args: string[], bonus: string): Token {
  const token = d20(bonus);
  const display = arg(args, 1);
  if (token.kind !== "roll") return display === undefined ? token : text(display);
  return display === undefined ? token : { ...token, display };
}

/** `{@hit 5}` is the d20 attack roll, so the notation is synthesized rather than read. */
function attackRoll(args: string[]): Token {
  return d20Tag(args, arg(args, 0) ?? "");
}

/** The trailing number of `{@skillCheck survival 4}` or `{@savingThrow con 3}`. */
function trailingBonus(body: string): string | undefined {
  const bonus = body.trim().split(/\s+/).at(-1) ?? "";
  return /^[+-]?\d+$/.test(bonus) ? bonus : undefined;
}

/**
 * `{@skillCheck survival 4}` carries the skill and the bonus in one space-separated
 * argument, and reads as "+4" beside the `{@skill}` tag that always precedes it.
 */
function skillCheck(args: string[]): Token {
  const body = arg(args, 0) ?? "";
  const bonus = trailingBonus(body);
  return bonus === undefined ? text(body) : d20Tag(args, bonus);
}

/**
 * `{@ability con 12|+1} on checks` shows that the display is the modifier alone, and
 * every explicit one in the corpus equals what `abilityModifier` computes from the
 * score beside it.
 */
function ability(args: string[]): Token {
  const override = arg(args, 1);
  if (override !== undefined) return text(override);
  const raw = arg(args, 0) ?? "";
  const score = raw.trim().split(/\s+/).at(-1) ?? "";
  if (!/^\d+$/.test(score)) return text(raw);
  const value = Number(score);
  const modifier = abilityModifier(value);
  return text(modifier < 0 ? `${modifier}` : `+${modifier}`);
}

/**
 * A bare `{@recharge}` means a 6 only; a number is the low end of the range. An `m`
 * second argument asks for the minimal look, which is the same words without brackets,
 * because the sentence already supplies its own.
 */
function recharge(args: string[]): Token {
  const low = arg(args, 0) ?? "6";
  const range = low === "6" ? "Recharge 6" : `Recharge ${low}–6`;
  return text(arg(args, 1) === "m" ? range : `(${range})`);
}

/** `name|source|display`, the shape of every tag that points at a catalog entity. */
const REF_TAGS = [
  "action",
  "background",
  "boon",
  "charoption",
  "condition",
  "creature",
  "creatureFluff",
  "deck",
  "deity",
  "disease",
  "facility",
  "feat",
  "hazard",
  "item",
  "itemMastery",
  "itemProperty",
  "cult",
  "language",
  "legroup",
  "object",
  "optfeature",
  "psionic",
  "race",
  "recipe",
  "reward",
  "sense",
  "skill",
  "spell",
  "status",
  "table",
  "trap",
  "variantrule",
  "vehicle",
  "vehupgrade",
];

/**
 * `display|target|…`. These point outside the catalog — a book page, a filtered list,
 * an external URL — so the display text is all there is to render.
 */
const OUTBOUND_TAGS = [
  "5etools",
  "5etoolsImg",
  "adventure",
  "area",
  "book",
  "color",
  "comic",
  "filter",
  "font",
  "link",
];

function buildSpecs(): Map<string, Spec> {
  const specs = new Map<string, Spec>();

  for (const tag of REF_TAGS) specs.set(tag, { kind: "ref", source: [1], display: 2 });
  for (const tag of OUTBOUND_TAGS) specs.set(tag, { kind: "text", display: 0 });

  // A deck or a pantheon sits between the name and the source.
  specs.set("card", { kind: "ref", source: [2], display: 3 });
  specs.set("deity", { kind: "ref", source: [2], display: 3 });
  specs.set("subclass", { kind: "ref", source: [3], display: 4 });

  // A feature source defaults to its subclass source, then to its class source.
  specs.set("classFeature", { kind: "ref", source: [4, 2], display: 5 });
  specs.set("subclassFeature", { kind: "ref", source: [6, 4, 2], display: 7 });
  specs.set("quickref", { kind: "text", display: 4 });
  // `{@unit <amount>|singular|plural}`. Every amount in the data is an unresolved
  // `{=…}` template, so the count cannot be known; recipe prose is mostly plural.
  specs.set("unit", { kind: "text", display: 2 });

  specs.set("dice", { kind: "roll", notation: 0, display: 1 });
  specs.set("damage", { kind: "roll", notation: 0, display: 1 });
  specs.set("scaledamage", { kind: "roll", notation: 2, display: 2 });

  specs.set("i", { kind: "style", style: "italic" });
  specs.set("italic", { kind: "style", style: "italic" });
  specs.set("b", { kind: "style", style: "bold" });
  specs.set("bold", { kind: "style", style: "bold" });
  specs.set("note", { kind: "wrapper" });

  const computed: Record<string, (args: string[]) => Token> = {
    // A save DC is a target number, not something to roll.
    dc: (args) => text(arg(args, 1) ?? `DC ${arg(args, 0) ?? ""}`),
    dcYourSpellSave: (args) => text(arg(args, 0) ?? "your spell save DC"),
    ability,
    class: classRef,
    // A plain d20 bonus, the same shape as {@hit} without the attack.
    d20: (args) => d20Tag(args, arg(args, 0) ?? ""),
    hit: attackRoll,
    // A saving throw is a d20 test, and the tag already carries the bonus.
    savingThrow: (args) => {
      const body = arg(args, 0) ?? "";
      const bonus = trailingBonus(body);
      return bonus === undefined ? text(body) : d20Tag(args, bonus);
    },
    scaledice,
    hitYourSpellAttack: (args) => text(arg(args, 0) ?? "your spell attack modifier"),
    h: () => text("Hit: "),
    m: () => text("Miss: "),
    atk: (args) => attack(args, " Attack:"),
    atkr: (args) => attack(args, " Attack Roll:"),
    recharge,
    chance: (args) => text(arg(args, 1) ?? `${arg(args, 0) ?? ""} percent`),
    actSave: (args) => {
      const ability = arg(args, 0) ?? "";
      return text(`${ABILITY_NAMES[ability.toLowerCase()] ?? ability} Saving Throw:`);
    },
    actSaveFail: (args) => {
      const tier = arg(args, 0);
      if (tier === undefined) return text("Failure:");
      const order = FAILURE_ORDER[tier];
      // An unnamed tier still has to read differently from the unnumbered form.
      return text(order === undefined ? `Failure ${tier}:` : `${order} Failure:`);
    },
    actSaveFailBy: (args) => text(`Failure by ${arg(args, 0) ?? ""} or More:`),
    actSaveSuccess: () => text("Success:"),
    actSaveSuccessOrFail: () => text("Failure or Success:"),
    actTrigger: () => text("Trigger:"),
    // The `d` form supplies its own separator, because no space follows it in the data.
    actResponse: (args) => text(arg(args, 0) === "d" ? "Response—" : "Response:"),
    hom: () => text("Hit or Miss: "),
    skillCheck,
  };
  for (const [tag, render] of Object.entries(computed)) {
    specs.set(tag, { kind: "computed", render });
  }

  return specs;
}

export const SPECS = buildSpecs();

/** The tags this parser knows. Anything else degrades, which is a choice worth auditing. */
export const KNOWN_TAGS: ReadonlySet<string> = new Set(SPECS.keys());
