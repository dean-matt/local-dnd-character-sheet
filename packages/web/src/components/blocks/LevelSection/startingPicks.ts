import {
  backgroundToolChoicesSchema,
  classSkillChoiceSchema,
  classToolChoicesSchema,
  type SearchHit,
  skillProficienciesChoiceSchema,
} from "@dnd/catalog";
import { type CharacterDefinition, type ContentRef, refKey } from "@dnd/character";
import { tally } from "../../../lib/pickTally.ts";
import type { Granted } from "../../../lib/proficiencyGrants.ts";
import { type EntryPick, skillPickOf, toolPicksOf } from "./entryPicks.ts";

const lower = (name: string) => name.toLowerCase();

/**
 * The skills and tools the old starting class's picks spent: the held ones its lists offer
 * that nothing else accounts for. What `granted` holds, the old class's and the sources left
 * in place, takes a proficiency first, and the class's lists then take the rest before the
 * race's and background's lists do. A held skill both the class and the background offer goes to the class.
 * Held proficiencies carry no record of where they came from, so a skill the player added
 * by hand that the class's list offers goes back too; a per-pick origin on the definition
 * is the way out.
 */
export function takenPicks({
  edition,
  old,
  background,
  race,
  skillHits,
  toolHits,
  granted,
  held,
}: {
  edition: CharacterDefinition["edition"];
  old: unknown;
  background: unknown;
  race: unknown;
  skillHits: readonly SearchHit[];
  toolHits: readonly SearchHit[];
  granted: readonly Granted[];
  held: CharacterDefinition["proficiencies"];
}): { skills: ContentRef[]; tools: string[] } {
  if (!old) return { skills: [], tools: [] };
  const classSkill = classSkillChoiceSchema.parse(old);
  const skillChoices = [
    classSkill,
    background ? skillProficienciesChoiceSchema.parse(background) : undefined,
    race ? skillProficienciesChoiceSchema.parse(race) : undefined,
  ];
  const skillOffers = skillChoices.flatMap((choice) =>
    choice ? [skillPickOf(choice, skillHits, [], edition)] : [],
  );
  const skills = tally(
    skillOffers,
    new Set(granted.flatMap((each) => each.skills.map((skill) => refKey(skill.ref)))),
    held.skills.map((skill) => skill.ref),
    refKey,
  );

  const own = toolPicksOf(classToolChoicesSchema.parse(old), toolHits, []);
  const others = background
    ? toolPicksOf(backgroundToolChoicesSchema.parse(background), toolHits, [])
    : [];
  const tools = tally(
    [...own, ...others],
    new Set(granted.flatMap((each) => each.tools.map((tool) => lower(tool.name)))),
    held.tools.map((tool) => tool.name),
    lower,
  );
  return {
    skills: classSkill ? (skills.picked[0] ?? []) : [],
    tools: tools.picked.slice(0, own.length).flat(),
  };
}

/**
 * The skill and tool lists the new starting class's row `json` offers, narrowed to what
 * `held` lacks once the swap is made. Nothing is offered where the row has not loaded or is
 * a homebrew class's.
 */
export function offeredPicks({
  edition,
  json,
  skillHits,
  toolHits,
  held,
}: {
  edition: CharacterDefinition["edition"];
  json: unknown;
  skillHits: readonly SearchHit[];
  toolHits: readonly SearchHit[];
  held: CharacterDefinition["proficiencies"];
}) {
  if (!json) return { skillPick: undefined, toolPicks: [] };
  const choice = classSkillChoiceSchema.parse(json);
  return {
    skillPick:
      choice &&
      skillPickOf(
        choice,
        skillHits,
        held.skills.map((skill) => skill.ref),
        edition,
      ),
    toolPicks: toolPicksOf(
      classToolChoicesSchema.parse(json),
      toolHits,
      held.tools.map((tool) => tool.name),
    ),
  };
}

/** `granted` with `skills` and `tools` held as proficient. */
export const withPicks = (
  granted: Granted,
  skills: readonly ContentRef[],
  tools: readonly string[],
): Granted => ({
  ...granted,
  skills: [...granted.skills, ...skills.map((ref) => ({ ref, level: "proficient" as const }))],
  tools: [...granted.tools, ...tools.map((name) => ({ name, level: "proficient" as const }))],
});

/** The options of each offered list that `made` holds, in the offered order. */
export function chosenPicks(
  made: { skills: readonly ContentRef[]; tools: readonly string[][] },
  skillPick: EntryPick<ContentRef> | undefined,
  toolPicks: readonly EntryPick<string>[],
) {
  const pickedSkills = (skillPick?.options ?? []).filter((ref) =>
    made.skills.some((each) => refKey(each) === refKey(ref)),
  );
  const pickedTools = toolPicks.map((pick, index) =>
    pick.options.filter((tool) => made.tools[index]?.includes(tool)),
  );
  return {
    pickedSkills,
    pickedTools,
    /** Every list holds as many picks as it asks. */
    ready:
      pickedSkills.length === (skillPick?.count ?? 0) &&
      toolPicks.every((pick, index) => pickedTools[index]?.length === pick.count),
  };
}

const toggled = <T>(list: readonly T[], item: T, same: (a: T) => boolean) =>
  list.some(same) ? list.filter((each) => !same(each)) : [...list, item];

/** What the new starting class's picks hold: its key, the skills, and the tools of each list. */
export type MadePicks = { cls: string; skills: ContentRef[]; tools: string[][] };

/** Handlers that set `made` to the picks `held` holds with one skill or one list's tool toggled. */
export function pickToggles(
  set: (made: MadePicks) => void,
  held: { cls: string; pickedSkills: ContentRef[]; pickedTools: string[][] },
) {
  return {
    toggleSkill: (ref: ContentRef) =>
      set({
        cls: held.cls,
        skills: toggled(held.pickedSkills, ref, (each) => refKey(each) === refKey(ref)),
        tools: held.pickedTools,
      }),
    toggleTool: (index: number, name: string) =>
      set({
        cls: held.cls,
        skills: held.pickedSkills,
        tools: held.pickedTools.map((each, at) =>
          at === index ? toggled(each, name, (tool) => tool === name) : each,
        ),
      }),
  };
}
