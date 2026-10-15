/**
 * A character's option counts, one per grantor and type, read from `content.db`: each
 * class's row at the level the character holds it, its subclass's row at that same level,
 * and a grant row for every feat and option held. `docs/optional-features.md` sums the
 * three tables in one query; this keeps them apart so a pick can name what entitled it.
 *
 * A grantor with no row, homebrew among them, entitles nothing: no homebrew table holds an
 * option count.
 */
import {
  type CharacterDefinition,
  type ContentRef,
  classLevels,
  type EntryRef,
  type OptionalFeatureEntitlement,
  refKey,
} from "@dnd/character";
import type { Edition } from "@dnd/rules";
import { openContentDb } from "../content.ts";

type Count = { featureType: string; known: number };

/**
 * The catalog rows a list holds, once each: an option picked under two types, as `Dueling`
 * (PHB) can be, is still one grantor.
 */
const held = (entries: readonly { ref: EntryRef }[]): ContentRef[] => [
  ...new Map(
    entries.flatMap(({ ref }) => ("name" in ref ? [[refKey(ref), ref] as const] : [])),
  ).values(),
];

export function listOptionalFeatureEntitlements(
  dataDir: string,
  definition: CharacterDefinition,
): OptionalFeatureEntitlement[] {
  const db = openContentDb(dataDir);
  try {
    const edition = (sql: string, ...params: unknown[]) =>
      db
        .prepare(sql)
        .pluck()
        .get(...params) as Edition | undefined;
    const counts = (sql: string, ...params: unknown[]) =>
      db
        .prepare(`SELECT feature_type AS featureType, known FROM ${sql} ORDER BY feature_type`)
        .all(...params) as Count[];
    const granting = (
      table: "feats" | "optional_features",
      ref: { name: string; source: string },
    ) => ({
      edition: edition(
        `SELECT edition FROM ${table} WHERE name = ? AND source = ?`,
        ref.name,
        ref.source,
      ),
      counts: counts(
        "granted_optional_features WHERE granted_by = ? AND name = ? AND source = ?",
        table,
        ref.name,
        ref.source,
      ),
    });
    const each = (
      grantedBy: OptionalFeatureEntitlement["grantedBy"],
      found: { edition: Edition | undefined; counts: Count[] },
    ): OptionalFeatureEntitlement[] =>
      found.edition === undefined
        ? []
        : found.counts.map((count) => ({ ...count, grantedBy, edition: found.edition as Edition }));

    return [
      ...classLevels(definition).flatMap(({ class: cls, level, subclass }) => {
        if (!("name" in cls)) return [];
        const own = each(
          { kind: "class", ref: cls },
          {
            edition: edition(
              "SELECT edition FROM classes WHERE name = ? AND source = ?",
              cls.name,
              cls.source,
            ),
            counts: counts(
              "class_optional_features WHERE class_name = ? AND class_source = ? AND level = ?",
              cls.name,
              cls.source,
              level,
            ),
          },
        );
        if (!subclass) return own;
        const keyed = [subclass.name, subclass.source, cls.name, cls.source];
        return [
          ...own,
          ...each(
            { kind: "subclass", ref: subclass, class: cls },
            {
              edition: edition(
                "SELECT edition FROM subclasses WHERE name = ? AND source = ? AND class_name = ? AND class_source = ?",
                ...keyed,
              ),
              counts: counts(
                `subclass_optional_features WHERE subclass_name = ? AND subclass_source = ?
                   AND class_name = ? AND class_source = ? AND level = ?`,
                ...keyed,
                level,
              ),
            },
          ),
        ];
      }),
      ...held(definition.feats).flatMap((ref) =>
        each({ kind: "feat", ref }, granting("feats", ref)),
      ),
      ...held(definition.optionalFeatures).flatMap((ref) =>
        each({ kind: "optionalFeature", ref }, granting("optional_features", ref)),
      ),
    ];
  } finally {
    db.close();
  }
}
