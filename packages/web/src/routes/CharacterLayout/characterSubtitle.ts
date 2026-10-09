import {
  type CharacterRecord,
  classLevelLabel,
  classLevels,
  displayName,
  totalLevel,
} from "@dnd/character";

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

/** `Lv. 20 · Human · Wizard / Warlock`, short enough for the header; a classless character has no level. */
export function headerSubtitle({ definition, raceSummary }: CharacterRecord): string {
  const level = totalLevel(definition);
  const classes = classLevels(definition)
    .map((group) => displayName(group.class))
    .join(" / ");
  return [level > 0 && `Lv. ${level}`, raceSummary, classes].filter(Boolean).join(" · ");
}
