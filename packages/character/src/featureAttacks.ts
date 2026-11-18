/**
 * What held features do to the character's own weapon attacks and unarmed strikes, read from
 * their recorded `attack` mechanics: advantage as roll effects, a bonus as a term on the
 * attack or damage, the lowest critical threshold, and a trade the player takes attack by
 * attack as an option.
 */
import { isHeavy, type Term, type Weapon } from "@dnd/rules";
import type { CharacterDerived, RollEffectEntry } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type Held, type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";

type AttackMechanic = Extract<Mechanic, { kind: "attack" }>;

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
