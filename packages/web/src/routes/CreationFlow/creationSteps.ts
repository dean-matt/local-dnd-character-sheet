import type { CharacterDefinition } from "@dnd/character";

/** The creation flow's steps, in the order the rail lists them and Next walks them. */
export const CREATION_STEPS = [
  { slug: "identity", label: "Identity" },
  { slug: "class", label: "Class" },
  { slug: "abilities", label: "Ability Scores" },
  { slug: "equipment", label: "Proficiencies & Equipment" },
  { slug: "spells", label: "Spells" },
] as const;

export type CreationStep = (typeof CREATION_STEPS)[number];

/**
 * The link to a step. The flow keeps one URL and carries the step in the history entry's
 * state, which a reload keeps; replacing the entry leaves browser Back one step out of
 * the flow rather than back through its steps.
 */
export const stepLink = (slug: CreationStep["slug"]) =>
  ({ to: "/characters/new", replace: true, state: { step: slug } }) as const;

/** The step a history entry's state names, or `undefined` for an entry the flow never marked. */
export function stepIn(state: unknown): CreationStep | undefined {
  const slug = (state as { step?: unknown } | null)?.step;
  return CREATION_STEPS.find((step) => step.slug === slug);
}

/**
 * The step that sets each part of the definition, or `null` for a part creation leaves at
 * its default. Exhaustive, so a field added to the definition fails to compile until it
 * names the step that owns it.
 */
const OWNER: Record<keyof CharacterDefinition, CreationStep["slug"] | null> = {
  name: "identity",
  race: "identity",
  subrace: "identity",
  size: "identity",
  raceResistance: "identity",
  background: "identity",
  alignment: "identity",
  deity: "identity",
  appearance: "identity",
  edition: "identity",
  levels: "class",
  feats: "class",
  optionalFeatures: "class",
  abilityScores: "abilities",
  abilityIncreases: "abilities",
  proficiencies: "equipment",
  inventory: "equipment",
  money: "equipment",
  spells: "spells",
  notes: null,
  houseRules: null,
  overrides: null,
  departures: null,
};

/** The step that sets the definition value at `path`, such as `abilityScores.str`. */
export function stepOf(path: string): CreationStep | undefined {
  const owner = OWNER[path.split(".")[0] as keyof CharacterDefinition];
  return CREATION_STEPS.find((step) => step.slug === owner);
}
