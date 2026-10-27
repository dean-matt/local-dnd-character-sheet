/**
 * Turns the `customSkills` an older definition carried into held homebrew skills.
 *
 * Pure: it takes the stored characters, their undo snapshots, the skills each edition's
 * catalog and the homebrew table already hold, and returns the homebrew rows to add, each
 * definition rewritten and which snapshots stay. The caller owns the transaction. The legacy
 * shape is read here through its own schema, so the live definition schema holds no trace
 * of it; delete this module once no stored file or database can still carry the field.
 */
import { ABILITIES, type Edition, PROFICIENCY_LEVELS } from "@dnd/rules";
import { z } from "zod";
import { characterDefinitionSchema } from "./definition.ts";

const HOMEBREW = "HB";
const FORMS = [...ABILITIES, "flat"] as const;
type Form = (typeof FORMS)[number];
const levelSchema = z.enum(PROFICIENCY_LEVELS);

const legacySkillsSchema = z.array(
  z.union([
    z.strictObject({ name: z.string(), ability: z.enum(ABILITIES), level: levelSchema }),
    z.strictObject({ name: z.string(), flat: z.int(), level: levelSchema }),
  ]),
);

const {
  edition: editionSchema,
  overrides: overridesSchema,
  proficiencies,
} = characterDefinitionSchema.shape;
const heldSchema = proficiencies.shape.skills;

type Held = z.infer<typeof heldSchema>[number];

/**
 * The parts of a legacy definition the conversion reads; the rest is carried over untouched. A
 * definition that fails fails with the character's id at the head of each issue's path, so a
 * start or an import that stops names the one to fix.
 */
function readLegacy(id: string, definition: Record<string, unknown>) {
  try {
    return {
      edition: editionSchema.parse(definition.edition),
      customSkills: legacySkillsSchema.parse(definition.customSkills ?? []),
      overrides: overridesSchema.parse(definition.overrides ?? {}),
      proficiencies: proficiencies.parse(definition.proficiencies),
    };
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error;
    throw new z.ZodError(error.issues.map((issue) => ({ ...issue, path: [id, ...issue.path] })));
  }
}

export type StoredCharacter = {
  id: string;
  definition: unknown;
  snapshots: { id: number; previousState: unknown }[];
};

export type ExistingHomebrewSkill = { name: string; edition: Edition; ability: Form };

export type SkillConversion = {
  homebrewToAdd: { name: string; edition: Edition; ability: Form }[];
  characters: { id: string; definition: Record<string, unknown> }[];
  snapshots: { characterId: string; id: number; keep: false | { previousState: unknown } }[];
  /** Each skill that took a new name, on the character that held it, for the rolls that cited it. */
  renames: { characterId: string; from: string; to: string }[];
};

const hasKey = (value: unknown): boolean =>
  typeof value === "object" && value !== null && "customSkills" in value;

const entriesOf = (value: unknown): unknown[] =>
  hasKey(value) && Array.isArray((value as { customSkills: unknown }).customSkills)
    ? (value as { customSkills: unknown[] }).customSkills
    : [];

/** Whether a stored definition or snapshot still carries the key, even empty. */
export const carriesCustomSkills = hasKey;

type Entry = {
  character: number;
  position: number;
  name: string;
  form: Form;
  level: Held["level"];
  flat: number;
};

const lower = (name: string) => name.toLowerCase();

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}
const rank = (level: Held["level"]) => PROFICIENCY_LEVELS.indexOf(level);

/** The entry whose values a merge keeps: higher level, then higher flat number, then earlier. */
const better = (a: Entry, b: Entry) =>
  rank(a.level) !== rank(b.level)
    ? rank(a.level) > rank(b.level)
    : a.flat !== b.flat
      ? a.flat > b.flat
      : a.character < b.character || (a.character === b.character && a.position < b.position);

type Parsed = {
  stored: StoredCharacter;
  definition: ReturnType<typeof readLegacy> | undefined;
};

type Naming = {
  edition: Edition;
  held: readonly ExistingHomebrewSkill[];
  catalog: ReadonlyMap<string, string>;
  taken: Set<string>;
  assigned: Set<string>;
  finalName: Map<Entry, string>;
};

/** The form that keeps the plain name: the existing row's, else the first; none where a catalog skill holds it. */
function plainForm(
  catalogSpelling: string | undefined,
  rows: readonly ExistingHomebrewSkill[],
  forms: readonly Form[],
): Form | undefined {
  if (catalogSpelling) return undefined;
  if (rows.length === 0) return forms[0];
  return forms.find((form) => rows.some((row) => row.ability === form));
}

/** The first ` (n)` name from `from` on that `used` does not hold, and the number after it. */
function firstFree(spelling: string, from: number, used: (lowered: string) => boolean) {
  for (let n = from; ; n++) {
    const name = `${spelling} (${n})`;
    if (!used(lower(name))) return { name, next: n + 1 };
  }
}

/** Names every form one name carries: the plain name to one, the rest numbered from 2. */
function nameGroup(key: string, group: readonly Entry[], naming: Naming) {
  const { edition, held, catalog, taken, assigned, finalName } = naming;
  const catalogSpelling = catalog.get(key);
  const rows = held.filter((skill) => lower(skill.name) === key);
  const spelling = catalogSpelling ?? rows[0]?.name ?? (group[0] as Entry).name;
  const forms = FORMS.filter((form) => group.some((entry) => entry.form === form));
  const plain = plainForm(catalogSpelling, rows, forms);

  const added: SkillConversion["homebrewToAdd"] = [];
  let next = 2;
  for (const form of forms) {
    const keepsPlain = form === plain;
    let name = spelling;
    if (!keepsPlain) {
      const free = firstFree(
        spelling,
        next,
        (candidate) => taken.has(candidate) || assigned.has(candidate),
      );
      name = free.name;
      next = free.next;
    }
    assigned.add(lower(name));
    if (!keepsPlain || !rows.some((row) => row.ability === form))
      added.push({ name, edition, ability: form });
    for (const member of group) if (member.form === form) finalName.set(member, name);
  }
  return added;
}

/** Settles the final name and form of every skill in one edition, and the rows to add for it. */
function nameEdition(
  edition: Edition,
  ofEdition: readonly Entry[],
  held: readonly ExistingHomebrewSkill[],
  catalog: ReadonlyMap<string, string>,
  finalName: Map<Entry, string>,
): SkillConversion["homebrewToAdd"] {
  const taken = new Set([
    ...held.map((skill) => lower(skill.name)),
    ...ofEdition.map((entry) => lower(entry.name)),
  ]);
  const naming: Naming = { edition, held, catalog, taken, assigned: new Set(), finalName };
  return [...groupBy(ofEdition, (entry) => lower(entry.name))].flatMap(([key, group]) =>
    nameGroup(key, group, naming),
  );
}

const winnerOf = (group: readonly Entry[]) => group.reduce((a, b) => (better(b, a) ? b : a));

/** The held entry for one merged group: the highest level and flat number among them and the character's own. */
function heldFor(name: string, group: readonly Entry[], already: Held | undefined): Held {
  const levels = [...group.map((entry) => entry.level), already?.level ?? "none"];
  const level = levels.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  const flats = [
    ...group.filter((entry) => entry.form === "flat").map((entry) => entry.flat),
    ...(already?.flat === undefined ? [] : [already.flat]),
  ];
  return {
    ref: already?.ref ?? { name, source: HOMEBREW },
    level,
    ...(group.some((entry) => entry.form === "flat") && { flat: Math.max(...flats) }),
  };
}

/** Holds each entry's skill on the character, merging the entries that landed on one name. */
function convertDefinition(
  stored: StoredCharacter,
  definition: NonNullable<Parsed["definition"]>,
  mine: readonly Entry[],
  finalName: ReadonlyMap<Entry, string>,
): Record<string, unknown> {
  const overrides = { ...definition.overrides };
  const skills: Held[] = [...definition.proficiencies.skills];

  for (const [name, group] of groupBy(mine, (entry) => finalName.get(entry) as string)) {
    const at = skills.findIndex(
      (skill) => skill.ref.source === HOMEBREW && lower(skill.ref.name) === lower(name),
    );
    const next = heldFor(name, group, at === -1 ? undefined : skills[at]);
    skills[at === -1 ? skills.length : at] = next;
    const winner = winnerOf(group);
    const from = `customSkills.${winner.name}.modifier`;
    const to = `skills.${next.ref.name}|${HOMEBREW}.modifier`;
    if (Object.hasOwn(overrides, from) && !Object.hasOwn(overrides, to))
      overrides[to] = overrides[from];
  }
  for (const key of Object.keys(overrides))
    if (key.startsWith("customSkills.")) delete overrides[key];

  const { customSkills: _dropped, ...rest } = stored.definition as Record<string, unknown>;
  return { ...rest, proficiencies: { ...definition.proficiencies, skills }, overrides };
}

/**
 * A row stays unless it holds entries or reversed a change to `customSkills`: its snapshot
 * differs from the next newer row's, or from the stored definition for the newest row.
 */
function convertSnapshots(characters: readonly StoredCharacter[]): SkillConversion["snapshots"] {
  const result: SkillConversion["snapshots"] = [];
  for (const character of characters) {
    const rows = [...character.snapshots].sort((a, b) => a.id - b.id);
    rows.forEach((row, i) => {
      const newer = rows[i + 1]?.previousState ?? character.definition;
      const entries = entriesOf(row.previousState);
      const dropped =
        entries.length > 0 || JSON.stringify(entries) !== JSON.stringify(entriesOf(newer));
      if (dropped) result.push({ characterId: character.id, id: row.id, keep: false });
      else if (carriesCustomSkills(row.previousState)) {
        const { customSkills: _gone, ...rest } = row.previousState as Record<string, unknown>;
        result.push({ characterId: character.id, id: row.id, keep: { previousState: rest } });
      }
    });
  }
  return result;
}

/**
 * `characters` arrive in creation order. A character with no `customSkills` key is left out
 * of the result. `catalogSkillNames` is asked only for an edition that holds an entry.
 */
export function convertCustomSkills(
  characters: readonly StoredCharacter[],
  existing: readonly ExistingHomebrewSkill[],
  catalogSkillNames: (edition: Edition) => readonly string[],
): SkillConversion {
  const parsed: Parsed[] = characters.map((stored) => ({
    stored,
    definition: carriesCustomSkills(stored.definition)
      ? readLegacy(stored.id, stored.definition as Record<string, unknown>)
      : undefined,
  }));

  const entries = parsed.flatMap(({ definition }, character) =>
    (definition?.customSkills ?? []).map(
      (skill, position): Entry => ({
        character,
        position,
        name: skill.name,
        form: "ability" in skill ? skill.ability : "flat",
        level: skill.level,
        flat: "flat" in skill ? skill.flat : 0,
      }),
    ),
  );

  const finalName = new Map<Entry, string>();
  const homebrewToAdd = (["classic", "one"] as const).flatMap((edition) => {
    const ofEdition = entries.filter(
      (entry) => parsed[entry.character]?.definition?.edition === edition,
    );
    if (ofEdition.length === 0) return [];
    const catalog = new Map(catalogSkillNames(edition).map((name) => [lower(name), name]));
    const held = existing.filter((skill) => skill.edition === edition);
    return nameEdition(edition, ofEdition, held, catalog, finalName);
  });

  const converted = parsed.flatMap(({ stored, definition }, index) =>
    definition
      ? [
          {
            id: stored.id,
            definition: convertDefinition(
              stored,
              definition,
              entries.filter((entry) => entry.character === index),
              finalName,
            ),
          },
        ]
      : [],
  );

  const seen = new Set<string>();
  const renames = entries.flatMap((entry) => {
    const to = finalName.get(entry);
    const characterId = characters[entry.character]?.id;
    const key = `${characterId}\0${entry.name}`;
    if (to === undefined || to === entry.name || characterId === undefined || seen.has(key))
      return [];
    seen.add(key);
    return [{ characterId, from: entry.name, to }];
  });

  return { homebrewToAdd, characters: converted, snapshots: convertSnapshots(characters), renames };
}
