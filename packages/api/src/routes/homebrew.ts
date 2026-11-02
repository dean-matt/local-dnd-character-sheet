/**
 * What the homebrew routes for items, spells, backgrounds, feats, races, classes, subclasses and subraces share.
 * `source` and `id` are never accepted from a request body — the query layer stamps
 * `source` and each route generates `id` once, on create, the same rule `characters.ts`
 * sets for `name`/`level`/`edition`.
 *
 * A delete needs `characters.db` as well as `homebrew.db`: no foreign key spans the two
 * files, so each route enforces the reference instead.
 *
 * A homebrew name is unique within its kind and edition, because a `{@tag}` names the row
 * by it. A create or rename onto a name another row holds answers 409 with that row.
 */
import {
  type HomebrewBackgroundRecord,
  type HomebrewClassRecord,
  type HomebrewDeityRecord,
  type HomebrewFeatRecord,
  type HomebrewItemRecord,
  type HomebrewMonsterRecord,
  type HomebrewOptionalFeatureRecord,
  type HomebrewRaceRecord,
  type HomebrewSkillRecord,
  type HomebrewSpellRecord,
  type HomebrewSubclassRecord,
  type HomebrewSubraceRecord,
  homebrewBackgroundRecordSchema,
  homebrewClassRecordSchema,
  homebrewDeityRecordSchema,
  homebrewFeatRecordSchema,
  homebrewItemRecordSchema,
  homebrewMonsterRecordSchema,
  homebrewOptionalFeatureRecordSchema,
  homebrewRaceRecordSchema,
  homebrewSkillRecordSchema,
  homebrewSpellRecordSchema,
  homebrewSubclassRecordSchema,
  homebrewSubraceRecordSchema,
} from "@dnd/catalog";
import { EDITIONS, type Edition } from "@dnd/rules";
import { z } from "@hono/zod-openapi";
import { SqliteError } from "better-sqlite3";
import {
  type getHomebrewBackground,
  type getHomebrewClass,
  type getHomebrewDeity,
  type getHomebrewFeat,
  type getHomebrewItem,
  type getHomebrewMonster,
  type getHomebrewOptionalFeature,
  type getHomebrewRace,
  type getHomebrewSkill,
  type getHomebrewSpell,
  type getHomebrewSubclass,
  type getHomebrewSubrace,
  type HomebrewDb,
  homebrewNamed,
  type NamedHomebrewTable,
} from "../db/queries/homebrew.ts";

type ItemRow = NonNullable<ReturnType<typeof getHomebrewItem>>;
type SpellRow = NonNullable<ReturnType<typeof getHomebrewSpell>>;
type BackgroundRow = NonNullable<ReturnType<typeof getHomebrewBackground>>;
type FeatRow = NonNullable<ReturnType<typeof getHomebrewFeat>>;
type RaceRow = NonNullable<ReturnType<typeof getHomebrewRace>>;
type ClassRow = NonNullable<ReturnType<typeof getHomebrewClass>>;
type SubclassRow = NonNullable<ReturnType<typeof getHomebrewSubclass>>;
type SubraceRow = NonNullable<ReturnType<typeof getHomebrewSubrace>>;
type SkillRow = NonNullable<ReturnType<typeof getHomebrewSkill>>;
type OptionalFeatureRow = NonNullable<ReturnType<typeof getHomebrewOptionalFeature>>;
type MonsterRow = NonNullable<ReturnType<typeof getHomebrewMonster>>;
type DeityRow = NonNullable<ReturnType<typeof getHomebrewDeity>>;

/** Validates a row read back from SQLite against the same schema its write went through. */
export function toItemRecord(row: ItemRow): HomebrewItemRecord {
  return homebrewItemRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toSpellRecord(row: SpellRow): HomebrewSpellRecord {
  return homebrewSpellRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toBackgroundRecord(row: BackgroundRow): HomebrewBackgroundRecord {
  return homebrewBackgroundRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toFeatRecord(row: FeatRow): HomebrewFeatRecord {
  return homebrewFeatRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toRaceRecord(row: RaceRow): HomebrewRaceRecord {
  return homebrewRaceRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toClassRecord(row: ClassRow): HomebrewClassRecord {
  return homebrewClassRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

/** The entry carries the class it sits under and a short name, as a catalog subclass's does. */
export function toSubclassRecord(row: SubclassRow): HomebrewSubclassRecord {
  return homebrewSubclassRecordSchema.parse({
    id: row.id,
    name: row.name,
    edition: row.edition,
    className: row.className,
    classSource: row.classSource,
    classId: row.classId ?? undefined,
    json: {
      ...row.json,
      shortName: row.json.shortName ?? row.name,
      className: row.className,
      classSource: row.classSource,
    },
    createdAt: row.createdAt.toISOString(),
  });
}

export function toSubraceRecord(row: SubraceRow): HomebrewSubraceRecord {
  return homebrewSubraceRecordSchema.parse({
    id: row.id,
    name: row.name,
    edition: row.edition,
    raceName: row.raceName,
    raceSource: row.raceSource,
    raceId: row.raceId ?? undefined,
    json: row.json,
    createdAt: row.createdAt.toISOString(),
  });
}

export function toSkillRecord(row: SkillRow): HomebrewSkillRecord {
  return homebrewSkillRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toDeityRecord(row: DeityRow): HomebrewDeityRecord {
  return homebrewDeityRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export function toOptionalFeatureRecord(row: OptionalFeatureRow): HomebrewOptionalFeatureRecord {
  return homebrewOptionalFeatureRecordSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
  });
}

export function toMonsterRecord(row: MonsterRow): HomebrewMonsterRecord {
  return homebrewMonsterRecordSchema.parse({ ...row, createdAt: row.createdAt.toISOString() });
}

export const idParam = z.object({ id: z.string() });

const referencingCharacterSchema = z.object({ id: z.string(), name: z.string() });

export const referenced = (resource: string) => ({
  description: `A character still references this ${resource}`,
  content: {
    "application/json": {
      schema: z.object({ error: z.string(), characters: z.array(referencingCharacterSchema) }),
    },
  },
});

export const referencedError = (resource: string, characters: { id: string; name: string }[]) => ({
  error: `${resource} is referenced by ${characters.length === 1 ? "a character" : "characters"} and cannot be deleted`,
  characters,
});

const namedSchema = z.object({ id: z.string(), name: z.string() });

/** A skill is cited by name, from a character's proficiencies and an item's advantage effect. */
export const skillReferenced = {
  description: "A character or an item still cites this skill",
  content: {
    "application/json": {
      schema: z.object({
        error: z.string(),
        characters: z.array(namedSchema),
        items: z.array(namedSchema),
      }),
    },
  },
};

export const skillReferencedError = (
  action: string,
  characters: { id: string; name: string }[],
  items: { id: string; name: string }[],
) => ({
  error: `This skill is cited by ${[...characters, ...items].map(({ name }) => name).join(", ")} and cannot be ${action}`,
  characters,
  items,
});

const nameHolderSchema = z.object({ id: z.string(), name: z.string(), edition: z.enum(EDITIONS) });

type NameHolder = z.infer<typeof nameHolderSchema>;

export const nameTaken = (resource: string) => ({
  description: `Another ${resource} of that edition already has this name`,
  content: {
    "application/json": { schema: z.object({ error: z.string(), conflict: nameHolderSchema }) },
  },
});

export const nameTakenError = (resource: string, { id, name, edition }: NameHolder) => ({
  error: `The ${resource} ${id} is already named "${name}" in the ${edition} edition`,
  conflict: { id, name, edition },
});

/**
 * Runs `write`, answering a collision on the unique name index with the row holding the
 * name. The index decides, so a write that collides with nothing never pays the lookup.
 */
export function claimName<T>(
  write: () => T,
  holder: () => NameHolder | undefined,
): { row: T } | { taken: NameHolder } {
  try {
    return { row: write() };
  } catch (error) {
    const taken =
      error instanceof SqliteError && error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ? holder()
        : undefined;
    if (taken === undefined) throw error;
    return { taken };
  }
}

/** The row holding `name` in `edition` within `table`, read only once a write collides. */
export const holder =
  (
    db: HomebrewDb,
    table: NamedHomebrewTable,
    { name, edition }: { name: string; edition: Edition },
  ) =>
  () =>
    homebrewNamed(db, table, name, edition);
