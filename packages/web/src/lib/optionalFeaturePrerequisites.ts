import type { OptionalFeaturePrerequisite, SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, classLevels, displayName, totalLevel } from "@dnd/character";
import { searchHitKey } from "./searchHitKey.ts";

/** What an option's prerequisites are read against: the character as the picker sees it. */
export type PrerequisiteFacts = {
  level: number;
  /** Class levels by lowercased name, sources summed: a prerequisite names a class alone. */
  classes: Map<string, number>;
  /** Spells known, by lowercased name. */
  spells: Set<string>;
  /** Options held, keyed `name|source` lowercased, and by lowercased name alone. */
  options: Set<string>;
  optionNames: Set<string>;
};

export function prerequisiteFacts(
  definition: Pick<CharacterDefinition, "levels" | "spells" | "optionalFeatures">,
): PrerequisiteFacts {
  const classes = new Map<string, number>();
  for (const group of classLevels(definition)) {
    const name = displayName(group.class).toLowerCase();
    classes.set(name, (classes.get(name) ?? 0) + group.level);
  }
  const named = definition.optionalFeatures.flatMap(({ ref }) => ("name" in ref ? [ref] : []));
  return {
    level: totalLevel(definition),
    classes,
    spells: new Set(
      definition.spells.flatMap(({ ref }) => ("name" in ref ? [ref.name.toLowerCase()] : [])),
    ),
    options: new Set(named.map((ref) => `${ref.name}|${ref.source}`.toLowerCase())),
    optionNames: new Set(named.map((ref) => ref.name.toLowerCase())),
  };
}

const SMALL_WORDS = new Set(["a", "an", "and", "of", "or", "the", "to"]);

/** Upstream's lowercased `pact of the blade` as `Pact of the Blade`. */
const titled = (text: string) =>
  text
    .split(" ")
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");

/** Each judged part of one alternative the character falls short of, as a sheet prints it. */
function shortfalls(part: OptionalFeaturePrerequisite, facts: PrerequisiteFacts): string[] {
  const missing: string[] = [];
  if (part.level !== undefined) {
    const held = part.className
      ? (facts.classes.get(part.className.toLowerCase()) ?? 0)
      : facts.level;
    if (held < part.level) {
      missing.push(
        part.className ? `${part.className} level ${part.level}` : `Level ${part.level}`,
      );
    }
  }
  if (part.pact && !facts.optionNames.has(`pact of the ${part.pact.toLowerCase()}`)) {
    missing.push(`Pact of the ${part.pact}`);
  }
  if (part.spells.length > 0 && !part.spells.some((spell) => facts.spells.has(spell))) {
    missing.push(part.spells.map(titled).join(" or "));
  }
  if (part.options.length > 0 && !part.options.some((key) => facts.options.has(key))) {
    missing.push(part.options.map((key) => titled(key.split("|")[0] ?? key)).join(" or "));
  }
  return missing;
}

/** What an option needs that the character lacks, as `Pact of the Tome`, or `undefined` once met. */
export function unmetNeeds(
  prerequisites: readonly OptionalFeaturePrerequisite[],
  facts: PrerequisiteFacts,
): string | undefined {
  const missing = prerequisites.map((part) => shortfalls(part, facts));
  if (missing.some((each) => each.length === 0)) return undefined;
  return missing[0]?.join(", ");
}

/**
 * What an option needs that the character lacks, and what it needs that the sheet cannot
 * check, each a line to print or `undefined` for none. An option is met by any alternative
 * whose judged parts all hold; where none does, the first alternative's shortfall is the one
 * named. What cannot be checked never refuses a pick.
 */
export function prerequisiteNotes(
  prerequisites: readonly OptionalFeaturePrerequisite[],
  facts: PrerequisiteFacts,
): { unmet: string | undefined; unchecked: string | undefined } {
  const missing = prerequisites.map((part) => shortfalls(part, facts));
  const met = missing.findIndex((each) => each.length === 0);
  const shown = prerequisites[met === -1 ? 0 : met];
  const unchecked = shown?.unjudged ?? [];
  const needs = unmetNeeds(prerequisites, facts);
  return {
    unmet: needs && `Needs ${needs}`,
    unchecked: unchecked.length > 0 ? `Not checked: ${unchecked.join(", ")}` : undefined,
  };
}

/**
 * A picker's judgment of each option it lists: one `held` already holds, keyed as
 * `searchHitKey` keys a hit, or one whose prerequisite the character falls short of, cannot
 * be picked and says why; what the sheet cannot check shows beneath the name.
 */
export function optionalFeatureJudge(facts: PrerequisiteFacts, held: ReadonlySet<string>) {
  const notes = (hit: SearchHit) =>
    "optionalFeature" in hit && hit.optionalFeature
      ? prerequisiteNotes(hit.optionalFeature.prerequisites, facts)
      : undefined;
  return {
    unavailableReason: (hit: SearchHit) =>
      held.has(searchHitKey(hit)) ? "Chosen already" : notes(hit)?.unmet,
    describe: (hit: SearchHit) => notes(hit)?.unchecked,
  };
}
