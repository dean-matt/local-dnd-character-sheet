import {
  type CharacterRecord,
  classLevelLabel,
  classLevels,
  displayName,
  type HomebrewNames,
  totalLevel,
} from "@dnd/character";

/** Race, classes with levels, then background and whatever else the player set, in one line. */
export function characterSubtitle(
  { definition, raceSummary }: CharacterRecord,
  names: HomebrewNames,
): string {
  const classes = classLevels(definition)
    .map((group) => classLevelLabel(group, names))
    .join(" / ");
  const { alignment, deity } = definition;
  return [
    [raceSummary, classes].filter(Boolean).join(" "),
    displayName(definition.background, names),
    alignment,
    deity && `${deity.name} (${deity.pantheon})`,
  ]
    .filter(Boolean)
    .join(" • ");
}

/** `Lv. 20 · Human · Wizard / Warlock`, short enough for the header; a classless character has no level. */
export function headerSubtitle(
  { definition, raceSummary }: CharacterRecord,
  names: HomebrewNames,
): string {
  const level = totalLevel(definition);
  const classes = classLevels(definition)
    .map((group) => displayName(group.class, names))
    .join(" / ");
  return [level > 0 && `Lv. ${level}`, raceSummary, classes].filter(Boolean).join(" · ");
}
