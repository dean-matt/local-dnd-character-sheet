/**
 * What held features do to the character's own weapon attacks and unarmed strikes, read from
 * their recorded `attack` mechanics: advantage as roll effects, a bonus as a term on the
 * attack or damage, the lowest critical threshold, and a trade the player takes attack by
 * attack as an option. Their `extraDamage` mechanics give the dice a hit adds.
 */
import { ABILITIES, isFinesse, isHeavy, isThrown, type Term, type Weapon } from "@dnd/rules";
import type { CharacterDerived, RollEffectEntry } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type Held, type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";
import type { SpellCastOption } from "./spellCast.ts";

type AttackMechanic = Extract<Mechanic, { kind: "attack" }>;
type ExtraDamageMechanic = Extract<Mechanic, { kind: "extraDamage" }>;
type FeatureDamage = CharacterDerived["attacks"][number]["featureDamage"][number];

/** One attack as the mechanics judge it; `weapon` is absent for an unarmed strike. */
export type Strike = {
  weapon?: Pick<Weapon, "kind" | "properties">;
  proficient: boolean;
  /** A melee weapon held in one hand with no other weapon equipped. */
  alone: boolean;
};

export type FeatureStrike = {
  attack: Term<TermReference>[];
  damage: Term<TermReference>[];
  /** The lowest threshold a feature gives, absent where none lowers it. */
  critical?: { label: string; value: number };
  options: CharacterDerived["attacks"][number]["options"];
};

function fits({ weapons, proficient }: AttackMechanic, { weapon, ...strike }: Strike): boolean {
  if (proficient && !strike.proficient) return false;
  switch (weapons) {
    case undefined:
      return true;
    case "melee":
    case "ranged":
      return weapon?.kind === weapons;
    case "thrown":
      return weapon !== undefined && isThrown(weapon);
    case "heavyMelee":
      return weapon?.kind === "melee" && isHeavy(weapon);
    case "oneHandedMelee":
      return weapon?.kind === "melee" && strike.alone;
  }
}

const attackMechanics = (definition: HoldsFeatures) =>
  heldFeatures(definition).flatMap((held) =>
    mechanicsOfKind(held.entry, "attack").map((mechanic) => ({ held, mechanic })),
  );

/** The advantage held features give on attacks, each cited to its feature. */
export function featureAttackEffects(definition: HoldsFeatures): RollEffectEntry[] {
  return attackMechanics(definition).flatMap(({ held, mechanic }) =>
    mechanic.advantage
      ? [
          {
            source: held.ref.name,
            mode: "advantage" as const,
            roll: "attack" as const,
            ...(mechanic.ability && { target: mechanic.ability }),
            ...(mechanic.option && { condition: mechanic.option }),
          },
        ]
      : [],
  );
}

const term = ({ ref }: Held, value: number): Term<TermReference> => ({
  label: ref.name,
  value,
  reference: ref,
});

/**
 * Adds what one bonus or critical mechanic of `held` gives to `into`; an ability's modifier
 * adds at least 1. An option carries its critical range, null where it lowers none.
 */
function addMechanic(
  into: FeatureStrike,
  held: Held,
  mechanic: AttackMechanic,
  modifier: (ability: Ability) => number,
) {
  const { damage = 0, critical, option } = mechanic;
  const attack =
    typeof mechanic.attack === "string"
      ? Math.max(1, modifier(mechanic.attack))
      : (mechanic.attack ?? 0);
  if (option) {
    into.options.push({
      source: held.ref.name,
      attack,
      damage,
      critical: critical ?? null,
      condition: option,
    });
  } else if (critical !== undefined) {
    if (critical < (into.critical?.value ?? 20))
      into.critical = { label: held.ref.name, value: critical };
  } else {
    if (attack !== 0) into.attack.push(term(held, attack));
    if (damage !== 0) into.damage.push(term(held, damage));
  }
}

/** What held features add to one attack, as terms where a bonus always holds and as options where the player chooses it. */
export function featureStrike(
  definition: HoldsFeatures,
  strike: Strike,
  modifier: (ability: Ability) => number,
): FeatureStrike {
  const result: FeatureStrike = { attack: [], damage: [], options: [] };
  for (const { held, mechanic } of attackMechanics(definition))
    if (!mechanic.advantage && fits(mechanic, strike))
      addMechanic(result, held, mechanic, modifier);
  return result;
}

/** What extra damage reads off the sheet: a class table column's cell at the character's level, an ability's modifier, the proficiency bonus, and whether a rage holds. */
export type DamageSheet = {
  column: (key: string) => string | undefined;
  modifier: (ability: Ability) => number;
  proficiency: number;
  raging: boolean;
};

const isAbility = (dice: ExtraDamageMechanic["dice"]): dice is Ability =>
  typeof dice === "string" && (ABILITIES as readonly string[]).includes(dice);

function lands({ weapons, unarmed }: ExtraDamageMechanic, { weapon }: Strike): boolean {
  if (!weapon) return unarmed === true || weapons === "unarmed";
  switch (weapons) {
    case undefined:
      return true;
    case "melee":
    case "ranged":
      return weapon.kind === weapons;
    case "finesseOrRanged":
      return weapon.kind === "ranged" || isFinesse(weapon);
    case "unarmed":
      return false;
  }
}

/** The flat amount a `dice` or `plus` term names, at `levels` in the feature's class. */
function flat(term: Ability | "proficiency" | "halfLevel", levels: number, sheet: DamageSheet) {
  if (term === "proficiency") return sheet.proficiency;
  if (term === "halfLevel") return Math.floor(levels / 2);
  return sheet.modifier(term);
}

/** The dice, or the flat amount, `mechanic` adds at `levels` in its feature's class; null where the sheet prints no cell. */
function amount(
  { dice, plus, scales = [] }: ExtraDamageMechanic,
  levels: number,
  sheet: DamageSheet,
): Pick<FeatureDamage, "dice" | "bonus"> | null {
  const bonus = plus ? flat(plus, levels, sheet) : 0;
  if (isAbility(dice)) return { dice: null, bonus: Math.max(1, sheet.modifier(dice)) };
  if (dice === "proficiency" || dice === "halfLevel")
    return { dice: null, bonus: flat(dice, levels, sheet) };
  if (typeof dice === "string") {
    const scaled = scales.filter((scale) => levels >= scale.level).at(-1);
    return { dice: scaled?.dice ?? dice, bonus };
  }
  const cell = sheet.column(dice.column);
  if (cell === undefined) return null;
  return { dice: dice.die ? `${Number(cell)}d${dice.die}` : cell, bonus };
}

/** The damage held features add to one attack on a hit, in the order the features are held. */
export function featureDamage(
  definition: HoldsFeatures,
  strike: Strike,
  sheet: DamageSheet,
): FeatureDamage[] {
  return heldFeatures(definition).flatMap((held) =>
    mechanicsOfKind(held.entry, "extraDamage").flatMap((mechanic) => {
      if (!lands(mechanic, strike) || (mechanic.while === "raging" && !sheet.raging)) return [];
      const added = amount(mechanic, held.levels, sheet);
      if (!added) return [];
      const { option, oncePerTurn, slot, type } = mechanic;
      return [
        {
          source: held.ref.name,
          ...added,
          type: type ?? null,
          offer: option
            ? { condition: option, oncePerTurn: oncePerTurn ?? false, slot: slot ?? null }
            : null,
        },
      ];
    }),
  );
}

/**
 * The dice one feature's damage rolls, null where it adds a flat amount: an offer for a spell
 * slot grows by a die for each `slotLevel` past the first, up to its `max`, and by one more
 * `versus` the creatures it names.
 */
export function featureDamageDice(
  { dice, offer }: FeatureDamage,
  slotLevel?: number,
  versus = false,
): string | null {
  const slot = offer?.slot;
  if (dice === null || !slot || slotLevel === undefined) return dice;
  const [count = 0, faces = 0] = dice.split("d").map(Number);
  return `${Math.min(count + slotLevel - 1, slot.max) + (versus && slot.versus ? 1 : 0)}d${faces}`;
}

/** The slots left that a feature's offer can spend: pact slots alone where it says so. */
export const offerSlots = (slots: readonly SpellCastOption[], offer: FeatureDamage["offer"]) =>
  offer?.slot?.pact ? slots.filter(({ via }) => via === "pact") : slots;
