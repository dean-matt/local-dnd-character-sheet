/**
 * Every catalog row a definition names, and the report of those the catalog no longer
 * answers. A homebrew reference is an id rather than a `(name, source)`, so neither lists it.
 */
import { z } from "zod";
import {
  type CharacterDefinition,
  type ContentRef,
  contentRefSchema,
  type EntryRef,
} from "./character.ts";

/** The catalog table a reference names a row of, one per shape of key. */
const CATALOG_KINDS = [
  "class",
  "subclass",
  "race",
  "subrace",
  "background",
  "skill",
  "language",
  "item",
  "spell",
  "feat",
  "optionalFeature",
  "deity",
] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

/**
 * One `(name, source)` and where the definition holds it, as a path such as
 * `spells[2].ref`. `parent` is the rest of a subclass's or a subrace's key, and
 * `pantheon` the rest of a deity's.
 */
export type CatalogReference = {
  field: string;
  kind: CatalogKind;
  ref: ContentRef;
  parent?: ContentRef;
  pantheon?: string;
};

const catalog = (ref: EntryRef | undefined): ContentRef | undefined =>
  ref === undefined || "homebrewId" in ref ? undefined : { name: ref.name, source: ref.source };

type Grantor =
  | NonNullable<CharacterDefinition["feats"][number]["grantedBy"]>
  | CharacterDefinition["optionalFeatures"][number]["grantedBy"];

const GRANTOR_KIND: Record<Grantor["kind"], CatalogKind> = {
  class: "class",
  subclass: "subclass",
  background: "background",
  race: "race",
  subrace: "subrace",
  feat: "feat",
  optionalFeature: "optionalFeature",
};

/** In definition order. A subclass or subrace under a homebrew parent has no catalog key. */
export function catalogReferences(definition: CharacterDefinition): CatalogReference[] {
  const found: CatalogReference[] = [];
  const add = (field: string, kind: CatalogKind, ref: EntryRef | undefined, parent?: EntryRef) => {
    const own = catalog(ref);
    const key = catalog(parent);
    if (!own || (parent !== undefined && !key)) return;
    found.push({ field, kind, ref: own, ...(key && { parent: key }) });
  };
  const grantor = (field: string, by: Grantor | undefined) => {
    if (!by) return;
    if (by.kind === "subclass") {
      add(`${field}.ref`, "subclass", by.ref, by.class);
      add(`${field}.class`, "class", by.class);
    } else if (by.kind === "subrace") {
      add(`${field}.ref`, "subrace", by.ref, by.race);
      add(`${field}.race`, "race", by.race);
    } else {
      add(`${field}.ref`, GRANTOR_KIND[by.kind], by.ref);
    }
  };

  definition.levels.forEach((level, i) => {
    add(`levels[${i}].class`, "class", level.class);
    add(`levels[${i}].subclass`, "subclass", level.subclass, level.class);
  });
  add("race", "race", definition.race);
  add("subrace", "subrace", definition.subrace, definition.race);
  add("background", "background", definition.background);
  definition.proficiencies.skills.forEach((skill, i) => {
    add(`proficiencies.skills[${i}].ref`, "skill", skill.ref);
  });
  definition.proficiencies.languages.forEach((language, i) => {
    add(`proficiencies.languages[${i}]`, "language", language);
  });
  definition.inventory.forEach((entry, i) => {
    add(`inventory[${i}].ref`, "item", entry.ref);
    add(`inventory[${i}].variant`, "item", entry.variant);
  });
  definition.spells.forEach((entry, i) => {
    add(`spells[${i}].ref`, "spell", entry.ref);
    add(`spells[${i}].origin`, "class", entry.origin);
  });
  definition.feats.forEach((entry, i) => {
    add(`feats[${i}].ref`, "feat", entry.ref);
    grantor(`feats[${i}].grantedBy`, entry.grantedBy);
  });
  definition.optionalFeatures.forEach((entry, i) => {
    add(`optionalFeatures[${i}].ref`, "optionalFeature", entry.ref);
    grantor(`optionalFeatures[${i}].grantedBy`, entry.grantedBy);
  });
  const { deity } = definition;
  if (deity) {
    found.push({
      field: "deity",
      kind: "deity",
      ref: { name: deity.name, source: deity.source },
      pantheon: deity.pantheon,
    });
  }
  return found;
}

/**
 * A reference no catalog row answers. `renamedTo` is the row upstream's redirect map says
 * it became, reported rather than written back: following it can move a character to the
 * other edition, which is the user's call.
 */
const unresolvedReferenceSchema = z.strictObject({
  field: z.string().min(1),
  kind: z.enum(CATALOG_KINDS),
  ref: contentRefSchema,
  parent: contentRefSchema.optional(),
  pantheon: z.string().min(1).optional(),
  renamedTo: contentRefSchema.optional(),
});

export const characterReferencesSchema = z.strictObject({
  unresolved: z.array(unresolvedReferenceSchema),
});

export type CharacterReferences = z.infer<typeof characterReferencesSchema>;
