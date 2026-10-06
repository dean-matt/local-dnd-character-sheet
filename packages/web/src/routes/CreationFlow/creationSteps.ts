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
 * The step that sets each part of the definition, or `null` for a part creation leaves at
 * its default. Exhaustive, so a field added to the definition fails to compile until it
 * names the step that owns it.
 */
const OWNER: Record<keyof CharacterDefinition, CreationStep["slug"] | null> = {
  name: "identity",
  race: "identity",
  subrace: "identity",
  background: "identity",
  alignment: "identity",
  deity: "identity",
  appearance: "identity",
  edition: "class",
  levels: "class",
  feats: "class",
  optionalFeatures: "class",
  abilityScores: "abilities",
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
