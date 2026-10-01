import { type CharacterRecord, classLevelLabel, classLevels, displayName } from "@dnd/character";

/** Race, classes with levels, then background and whatever else the player set, in one line. */
export function characterSubtitle({ definition, raceSummary }: CharacterRecord): string {
  const classes = classLevels(definition).map(classLevelLabel).join(" / ");
  const { alignment, deity } = definition;
  return [
    [raceSummary, classes].filter(Boolean).join(" "),
    displayName(definition.background),
    alignment,
    deity && `${deity.name} (${deity.pantheon})`,
  ]
    .filter(Boolean)
    .join(" • ");
}
