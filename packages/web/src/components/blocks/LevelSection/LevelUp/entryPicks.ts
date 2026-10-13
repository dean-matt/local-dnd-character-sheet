/**
 * The skill and tool picks a class's multiclass gains offer, narrowed to what the character
 * lacks. A pick asks for fewer where fewer are left; the 2014 rule's pick of any skill or
 * tool in place of one gained twice is the way past that.
 */
import type { SearchHit, SkillChoice, ToolChoice } from "@dnd/catalog";
import { type CharacterDefinition, type ContentRef, refKey } from "@dnd/character";
import { catalogRow, titleCase } from "../../../../lib/proficiencyGrants.ts";

/** A pick the class offers on entry: `count` of `options`. */
export type EntryPick<T> = { count: number; options: T[] };

/** `options` without a repeat, each named once by `key`. */
const unique = <T>(options: readonly T[], key: (option: T) => string) => [
  ...new Map(options.map((option) => [key(option), option])).values(),
];

const lower = (name: string) => name.toLowerCase();

/** `choice` resolved against the skill rows in `hits`, without the skills `held` names. */
export function skillPickOf(
  choice: SkillChoice,
  hits: readonly SearchHit[],
  held: readonly ContentRef[],
  edition: CharacterDefinition["edition"],
): EntryPick<ContentRef> {
  const heldKeys = new Set(held.map(refKey));
  const every = [
    ...new Set(hits.flatMap((hit) => (hit.type === "skill" ? [lower(hit.name)] : []))),
  ];
  const options = unique(
    (choice.from ?? every).flatMap((skill) => catalogRow(hits, "skill", skill, edition) ?? []),
    refKey,
  ).filter((ref) => !heldKeys.has(refKey(ref)));
  return { count: Math.min(choice.count, options.length), options };
}

/**
 * Each of `choices` as the tools it names and every tool of a kind it names among `hits`,
 * named as the catalog names them, without the tools `held` names.
 */
export function toolPicksOf(
  choices: readonly ToolChoice[],
  hits: readonly SearchHit[],
  held: readonly string[],
): EntryPick<string>[] {
  const heldKeys = new Set(held.map(lower));
  const named = (tool: string) =>
    hits.find((hit) => lower(hit.name) === tool)?.name ?? titleCase(tool);
  return choices.map((choice) => {
    const options = unique(
      [
        ...choice.names.map(named),
        ...hits.flatMap((hit) =>
          hit.item?.tool !== undefined && choice.types.includes(hit.item.tool) ? [hit.name] : [],
        ),
      ],
      lower,
    ).filter((tool) => !heldKeys.has(lower(tool)));
    return { count: Math.min(choice.count, options.length), options };
  });
}
