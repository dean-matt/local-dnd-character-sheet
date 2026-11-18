/**
 * What held features do to the character's own weapon attacks and unarmed strikes, read from
 * their recorded `attack` mechanics: advantage as roll effects, a bonus as a term on the
 * attack or damage, the lowest critical threshold, and a trade the player takes attack by
 * attack as an option. Their `extraDamage` mechanics give the dice a hit adds.
 */
import { ABILITIES, isFinesse, isHeavy, type Term, type Weapon } from "@dnd/rules";
import type { CharacterDerived, RollEffectEntry } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type Held, type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";

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
    case "ranged":
      return weapon?.kind === "ranged";
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

/** Adds what one bonus or critical mechanic of `held` gives to `into`. */
function addMechanic(into: FeatureStrike, held: Held, mechanic: AttackMechanic) {
  const { attack = 0, damage = 0, critical, option } = mechanic;
  if (critical !== undefined) {
    if (critical < (into.critical?.value ?? 20))
      into.critical = { label: held.ref.name, value: critical };
  } else if (option) {
    into.options.push({ source: held.ref.name, attack, damage, condition: option });
  } else {
    if (attack !== 0) into.attack.push(term(held, attack));
    if (damage !== 0) into.damage.push(term(held, damage));
  }
}

/** What held features add to one attack, as terms where a bonus always holds and as options where the player chooses it. */
export function featureStrike(definition: HoldsFeatures, strike: Strike): FeatureStrike {
  const result: FeatureStrike = { attack: [], damage: [], options: [] };
  for (const { held, mechanic } of attackMechanics(definition))
    if (!mechanic.advantage && fits(mechanic, strike)) addMechanic(result, held, mechanic);
  return result;
}

/** What extra damage reads off the sheet: a class table column's cell at the character's level, and an ability's modifier. */
export type DamageSheet = {
  column: (key: string) => string | undefined;
  modifier: (ability: Ability) => number;
  raging: boolean;
};

const isAbility = (dice: ExtraDamageMechanic["dice"]): dice is Ability =>
  typeof dice === "string" && (ABILITIES as readonly string[]).includes(dice);

function lands({ weapons, unarmed }: ExtraDamageMechanic, { weapon }: Strike): boolean {
  if (!weapon) return unarmed === true;
  switch (weapons) {
    case undefined:
      return true;
    case "melee":
      return weapon.kind === "melee";
    case "finesseOrRanged":
      return weapon.kind === "ranged" || isFinesse(weapon);
  }
}

/** The dice, or the flat amount, `mechanic` adds at `levels` in its feature's class; null where the sheet prints no cell. */
function amount(
  { dice, scales = [] }: ExtraDamageMechanic,
  levels: number,
  sheet: DamageSheet,
): Pick<FeatureDamage, "dice" | "bonus"> | null {
  if (isAbility(dice)) return { dice: null, bonus: Math.max(1, sheet.modifier(dice)) };
  if (typeof dice === "string") {
    const scaled = scales.filter((scale) => levels >= scale.level).at(-1);
    return { dice: scaled?.dice ?? dice, bonus: 0 };
  }
  const cell = sheet.column(dice.column);
  if (cell === undefined) return null;
  return { dice: dice.die ? `${Number(cell)}d${dice.die}` : cell, bonus: 0 };
}

/** The damage held features add to one attack on a hit, in the order the features are held. */
export function featureDamage(
  definition: HoldsFeatures,
  strike: Strike,
  sheet: DamageSheet,
): FeatureDamage[] {
  return heldFeatures(definition).flatMap((held) =>
    mechanicsOfKind(held.entry, "extraDamage").flatMap((mechanic) => {
      if (!lands(mechanic, strike) || (mechanic.while && !sheet.raging)) return [];
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
  return `${Math.min(count + slotLevel - 1, slot.max) + (versus ? 1 : 0)}d${faces}`;
}
