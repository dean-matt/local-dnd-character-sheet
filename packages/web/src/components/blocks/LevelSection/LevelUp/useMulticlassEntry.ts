import {
  classProficiencyGrantsSchema,
  classSkillChoiceSchema,
  classToolChoicesSchema,
  multiclassEntrySchema,
  multiclassPrerequisiteSchema,
} from "@dnd/catalog";
import {
  type Ability,
  abilityScore,
  type CharacterDefinition,
  classLevels,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { classQuery } from "../../../../hooks/classQuery.ts";
import { useCatalogSearch } from "../../../../hooks/useCatalogSearch.ts";
import { meetsPrerequisite } from "../../../../lib/multiclassPrerequisites.ts";
import { type Granted, NO_GRANTS, resolveGrants } from "../../../../lib/proficiencyGrants.ts";
import { skillPickOf, toolPicksOf } from "./entryPicks.ts";

const catalogOf = (cls: EntryRef) => ("name" in cls ? cls : undefined);

/** A catalog class's prerequisite once its row loads; a homebrew class needs no score. */
export const prerequisiteOf = (cls: EntryRef, json: unknown) =>
  !catalogOf(cls) ? [] : json ? multiclassPrerequisiteSchema.parse(json) : undefined;

/**
 * What a level in `cls` brings where the character does not hold the class yet: the
 * multiclass gains its row grants outright, the skill and tool picks those gains offer, and
 * the multiclass prerequisite of every class the character would then hold, the new one
 * included. `json` is the new class's catalog row; a homebrew class grants nothing and needs
 * no score. Scores are judged as the definition stores them, without an item's grant, as creation
 * judges them.
 */
export function useMulticlassEntry(
  definition: CharacterDefinition,
  cls: EntryRef,
  name: string,
  json: unknown,
) {
  const { edition, proficiencies } = definition;
  const entering = definition.levels.every((level) => entryKey(level.class) !== entryKey(cls));
  const start = entering && catalogOf(cls) && json ? multiclassEntrySchema.parse(json) : undefined;
  const skillChoice = start && classSkillChoiceSchema.parse(start);
  const toolChoices = start ? classToolChoicesSchema.parse(start) : [];
  const groups = classLevels(definition);
  const heldRows = useQueries({
    queries: groups.map((group) => classQuery(entering ? catalogOf(group.class) : undefined)),
  });
  // One edition holds at most 168 skill and language rows, and some fifty mundane tools,
  // each under the route's 200. Past that, a pick leaves out the rows beyond the page.
  const names = useCatalogSearch({
    edition,
    type: "skill,language",
    query: "",
    listAll: skillChoice !== undefined,
    limit: 200,
  });
  const tools = useCatalogSearch({
    edition,
    type: "item",
    query: "",
    listAll: toolChoices.length > 0,
    limit: 200,
    filters: { kind: "tool", rarity: "none" },
  });

  const score = (ability: Ability) => abilityScore(definition, ability);
  const judged = entering
    ? [
        ...groups.map((group, index) => ({
          name: displayName(group.class),
          firstIndex: definition.levels.findIndex(
            (level) => entryKey(level.class) === entryKey(group.class),
          ),
          prerequisite: prerequisiteOf(group.class, heldRows[index]?.data?.json),
        })),
        {
          name,
          firstIndex: definition.levels.length,
          prerequisite: prerequisiteOf(cls, json),
        },
      ]
    : [];

  const granted: Granted =
    start === undefined
      ? NO_GRANTS
      : resolveGrants([classProficiencyGrantsSchema.parse(start)], [], edition);

  const skillPick =
    skillChoice &&
    skillPickOf(
      skillChoice,
      names.data?.items ?? [],
      proficiencies.skills.map((skill) => skill.ref),
      edition,
    );
  const toolPicks = toolPicksOf(toolChoices, tools.data?.items ?? [], [
    ...proficiencies.tools.map((tool) => tool.name),
    ...granted.tools.map((tool) => tool.name),
  ]);

  const rowsRead = groups.every(
    (group, index) => !catalogOf(group.class) || heldRows[index]?.isSuccess,
  );
  return {
    entering,
    granted,
    skillPick,
    toolPicks,
    /** Every class the rule binds, with whether the stored scores meet its prerequisite. */
    prerequisites: judged.map((each) => ({
      ...each,
      met: meetsPrerequisite(each.prerequisite ?? [], score),
    })),
    judged,
    score,
    /** A row or list the entry reads failed to load, so it never becomes `read`. */
    failed: entering && (heldRows.some((row) => row.isError) || names.isError || tools.isError),
    read:
      !entering ||
      (rowsRead &&
        (skillChoice === undefined || names.isSuccess) &&
        (toolChoices.length === 0 || tools.isSuccess)),
  };
}
