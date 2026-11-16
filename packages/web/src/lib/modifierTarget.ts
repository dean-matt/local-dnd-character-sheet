import { ABILITIES, ABILITY_LABEL, type TemporaryModifier } from "@dnd/character";

type Target = TemporaryModifier["target"];
type Skill = { name: string; source: string };

const SCALARS = {
  armorClass: "Armor class",
  attackRolls: "Attack rolls",
  speed: "Speed",
  hitPointMaximum: "Hit point maximum",
  check: "Ability checks",
} as const;

/** The value a `Select` option carries for `target`. */
export const targetValue = (target: Target): string =>
  target.kind === "save"
    ? `save:${target.ability}`
    : target.kind === "skill"
      ? `skill:${target.ref.name}|${target.ref.source}`
      : target.kind;

export const targetLabel = (target: Target): string =>
  target.kind === "save"
    ? `${ABILITY_LABEL[target.ability]} saving throw`
    : target.kind === "skill"
      ? target.ref.name
      : SCALARS[target.kind];

/** Every sheet value a modifier can move, the character's skills last. */
export function modifierTargets(skills: readonly Skill[]): Target[] {
  return [
    ...(Object.keys(SCALARS) as (keyof typeof SCALARS)[]).map((kind) => ({ kind })),
    ...ABILITIES.map((ability) => ({ kind: "save" as const, ability })),
    ...skills.map(({ name, source }) => ({ kind: "skill" as const, ref: { name, source } })),
  ];
}
