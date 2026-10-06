import type { ClassProficiencyGrants, ProficiencyGrants, SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, refKey } from "@dnd/character";

type Proficiencies = CharacterDefinition["proficiencies"];

/** What a race, a background and a class grant outright, in the shape the definition stores it. */
export type Granted = Proficiencies;

export const NO_GRANTS: Granted = {
  savingThrows: [],
  skills: [],
  languages: [],
  tools: [],
  weapons: [],
  armor: [],
};

/** A row's grants, with the saving throws a class row adds. */
type RowGrants = ProficiencyGrants | ClassProficiencyGrants;

/** The book whose skill or language row a grant names where several books print one. */
export const CORE_SOURCE = { classic: "PHB", one: "XPHB" } as const;

/** A name as a sheet prints it: `thieves' tools` as `Thieves' Tools`. */
export const titleCase = (name: string): string =>
  name.replace(
    /(^|[\s(])(\p{L})/gu,
    (_, before: string, letter: string) => `${before}${letter.toUpperCase()}`,
  );

/** Every name `grants` holds, as a sheet prints them, for saying what a row grants. */
export const grantNames = (grants: ProficiencyGrants): string[] =>
  [...grants.skills, ...grants.languages, ...grants.tools, ...grants.weapons, ...grants.armor].map(
    titleCase,
  );

/** `items` with each key's first holder alone. */
function firstOfEach<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const each = key(item);
    if (seen.has(each)) return false;
    seen.add(each);
    return true;
  });
}

const lower = (name: string) => name.toLowerCase();
const skillKey = (skill: Granted["skills"][number]) => refKey(skill.ref);
const toolKey = (tool: Granted["tools"][number]) => lower(tool.name);

/**
 * `grants` resolved against the skill and language rows in `hits`, preferring the core
 * book's row where several books print one, as `Common` is printed seven times. A name no
 * row answers grants nothing, since a reference must name a row.
 */
export function resolveGrants(
  grants: readonly RowGrants[],
  hits: readonly SearchHit[],
  edition: CharacterDefinition["edition"],
): Granted {
  const row = (type: "skill" | "language", name: string) => {
    const matches = hits.flatMap((hit) =>
      hit.type === type && "source" in hit && lower(hit.name) === name
        ? [{ name: hit.name, source: hit.source }]
        : [],
    );
    return matches.find((ref) => ref.source === CORE_SOURCE[edition]) ?? matches[0];
  };
  const all = <T extends string>(pick: (grant: RowGrants) => T[]) => [
    ...new Set(grants.flatMap(pick)),
  ];
  return {
    savingThrows: all((grant) => ("savingThrows" in grant ? grant.savingThrows : [])),
    skills: all((grant) => grant.skills).flatMap((name) => {
      const ref = row("skill", name);
      return ref ? [{ ref, level: "proficient" as const }] : [];
    }),
    languages: all((grant) => grant.languages).flatMap((name) => row("language", name) ?? []),
    tools: all((grant) => grant.tools).map((name) => ({
      name: titleCase(name),
      level: "proficient" as const,
    })),
    weapons: all((grant) => grant.weapons).map(titleCase),
    armor: all((grant) => grant.armor).map(titleCase),
  };
}

/** `list` with what `before` granted and `after` does not taken out, and `after` added. */
function swap<T>(
  list: readonly T[],
  before: readonly T[],
  after: readonly T[],
  key: (item: T) => string,
) {
  const kept = new Set(after.map(key));
  const gone = new Set(before.map(key).filter((each) => !kept.has(each)));
  return firstOfEach([...list.filter((item) => !gone.has(key(item))), ...after], key);
}

/**
 * The proficiencies once a race, background or class change replaces what `before` granted with
 * what `after` grants. What the player added by hand stays, and a proficiency already held
 * keeps its level, so expertise in a granted skill survives the grant arriving again.
 */
export function swapGrants(
  current: Proficiencies | undefined,
  before: Granted,
  after: Granted,
): Proficiencies {
  const held = current ?? NO_GRANTS;
  return {
    savingThrows: swap(held.savingThrows, before.savingThrows, after.savingThrows, String),
    skills: swap(held.skills, before.skills, after.skills, skillKey),
    languages: swap(held.languages, before.languages, after.languages, refKey),
    tools: swap(held.tools, before.tools, after.tools, toolKey),
    weapons: swap(held.weapons, before.weapons, after.weapons, lower),
    armor: swap(held.armor, before.armor, after.armor, lower),
  };
}
