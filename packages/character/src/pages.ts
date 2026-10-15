import { z } from "zod";
import { isUnique } from "./keys.ts";

export const SHEET_SECTIONS = [
  "abilities",
  "spells",
  "inventory",
  "features",
  "identity",
  "level",
  "backstory",
  "notes",
] as const;

/** The whole sheet section a `section` block renders. */
const sectionBlockSchema = z.strictObject({
  kind: z.literal("section"),
  section: z.enum(SHEET_SECTIONS),
});

/**
 * The flat derived fields a `value` block can name — every `Derived<int>` on
 * `characterDerivedSchema` with no key of its own. `savingThrows`, `skills` and
 * `spellcasting` are keyed collections a block would need a second field to address,
 * and nothing renders them yet.
 */
export const VALUE_BLOCK_FIELDS = [
  "hitPointMaximum",
  "armorClass",
  "initiative",
  "proficiencyBonus",
] as const;

/** One derived value, shown with the breakdown behind it rather than arithmetic of its own. */
const valueBlockSchema = z.strictObject({
  kind: z.literal("value"),
  field: z.enum(VALUE_BLOCK_FIELDS),
});

/** Which of the sheet's own lists a `list` block narrows. Abilities is not a list. */
export const LIST_BLOCK_SOURCES = ["spells", "inventory", "features"] as const;

/**
 * What narrows a `list` block's rows. Every facet is optional, and a filter with none
 * matches every row. `search` matches a row's name.
 */
const listFilterSchema = z.strictObject({
  search: z.string().trim().min(1).optional(),
  levels: z
    .array(z.int().min(0).max(9))
    .min(1)
    .refine((levels) => isUnique(levels, String), {
      error: "the same spell level is listed twice",
    })
    .optional(),
  prepared: z.literal(true).optional(),
  equipped: z.literal(true).optional(),
});

/** The one source each source-specific facet narrows; a facet absent here narrows any. */
const LIST_FACET_SOURCE = {
  levels: "spells",
  prepared: "spells",
  equipped: "inventory",
} as const satisfies Partial<Record<keyof ListFilter, ListBlockSource>>;

/** Whether a list of `source` has `facet` to narrow by. */
export function facetApplies(facet: string, source: ListBlockSource): boolean {
  const only = LIST_FACET_SOURCE[facet as keyof typeof LIST_FACET_SOURCE];
  return only === undefined || only === source;
}

/** A saved filter over a list the sheet already renders, never a snapshot of the rows it matched. */
const listBlockSchema = z
  .strictObject({
    kind: z.literal("list"),
    source: z.enum(LIST_BLOCK_SOURCES),
    filter: listFilterSchema.default({}),
  })
  .refine(
    (block) => Object.keys(block.filter).every((facet) => facetApplies(facet, block.source)),
    { error: "the filter narrows by a facet this list does not have", path: ["filter"] },
  );

/** A note in the same `{@tag}` markup a catalog row's prose carries. */
const textBlockSchema = z.strictObject({
  kind: z.literal("text"),
  text: z.string(),
});

/**
 * Every block kind this build renders. A new kind is one entry here and one in the web
 * package's block registry, never a switch in either.
 */
const KNOWN_PAGE_BLOCK_SCHEMAS = [
  sectionBlockSchema,
  valueBlockSchema,
  listBlockSchema,
  textBlockSchema,
] as const;

/**
 * A block a stored page holds that this build does not recognize — an older kind a
 * rollback still needs to read, or a row a hand edit wrote wrong. `raw` carries the
 * original data through unchanged, so a page that reads one and is later saved whole
 * does not delete it.
 */
const unknownBlockSchema = z.strictObject({
  kind: z.literal("unknown"),
  raw: z.unknown(),
});

/**
 * One unit of a page's content. Strict like every schema in the package: a write naming a kind
 * this build does not know is refused. Only `degradePageBlock` produces the `unknown`
 * branch, wrapping a block a write would refuse for a read that already found one stored.
 */
const pageBlockSchema = z.discriminatedUnion("kind", [
  ...KNOWN_PAGE_BLOCK_SCHEMAS,
  unknownBlockSchema,
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;
export type ValueBlockField = (typeof VALUE_BLOCK_FIELDS)[number];
export type ListBlockSource = (typeof LIST_BLOCK_SOURCES)[number];
export type ListFilter = z.infer<typeof listFilterSchema>;
export type SheetSection = (typeof SHEET_SECTIONS)[number];

/**
 * A block read out of `characters.db` that the schema refuses degrades to `unknown`
 * rather than failing the whole page list — a hand edit, or a kind a newer build wrote
 * before a rollback. It parses against the full schema first, so a block already
 * wrapped this way on an earlier read passes through rather than being wrapped again.
 * The API's read path calls this at the boundary; a write still goes through
 * `pageBlockSchema` directly, refused the same as before.
 */
export function degradePageBlock(raw: unknown): PageBlock {
  const parsed = pageBlockSchema.safeParse(raw);
  return parsed.success ? parsed.data : { kind: "unknown", raw };
}

/** What a URL carries, so it survives a reorder and a retitle and needs no escaping. */
const pageSlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
  error: "a slug is lowercase letters and digits, joined by single hyphens",
});

/**
 * A slug for a new page titled `title`, distinct from every slug in `taken` and every
 * preset's, even a preset the character deleted: a page under a preset's slug is that
 * preset, and restoring the defaults recreates it there. A retitle keeps the slug it was
 * created with, so this runs once per page.
 */
export function newPageSlug(title: string, taken: Iterable<string>): string {
  const base =
    title
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page";
  const used = new Set([...taken, ...PRESET_PAGES.map((page) => page.slug)]);
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export const pageTitleSchema = z.string().trim().min(1);

const characterPageSchema = z.strictObject({
  slug: pageSlugSchema,
  title: pageTitleSchema,
  hidden: z.boolean().default(false),
  blocks: z.array(pageBlockSchema),
});

/** A character's pages in display order: the list a write replaces whole. */
export const characterPagesSchema = z
  .array(characterPageSchema)
  .refine((pages) => isUnique(pages, (page) => page.slug), {
    error: "the same slug is listed twice",
  });

/**
 * A stored page, as an endpoint returns it. The server sets `preset` from the slug and
 * never accepts it: restoring the defaults resets the presets alone, and recreates any
 * the user deleted.
 */
export const characterPageRecordSchema = characterPageSchema.extend({ preset: z.boolean() });

export type CharacterPage = z.infer<typeof characterPageSchema>;
export type CharacterPageRecord = z.infer<typeof characterPageRecordSchema>;

/**
 * Seeded on every character, in this order. A preset's blocks are whole sheet sections.
 * A new entry reaches existing characters only through a backfill migration, as every
 * entry here did. That migration must settle any user page already under the new slug,
 * which the next write would otherwise mark preset.
 */
export const PRESET_PAGES: readonly CharacterPage[] = [
  {
    slug: "stats",
    title: "Stats",
    hidden: false,
    blocks: [{ kind: "section", section: "abilities" }],
  },
  {
    slug: "spells",
    title: "Spells",
    hidden: false,
    blocks: [{ kind: "section", section: "spells" }],
  },
  {
    slug: "inventory",
    title: "Inventory",
    hidden: false,
    blocks: [{ kind: "section", section: "inventory" }],
  },
  {
    slug: "features",
    title: "Features",
    hidden: false,
    blocks: [{ kind: "section", section: "features" }],
  },
  {
    slug: "identity",
    title: "Identity",
    hidden: false,
    blocks: [{ kind: "section", section: "identity" }],
  },
  {
    slug: "level",
    title: "Level",
    hidden: false,
    blocks: [{ kind: "section", section: "level" }],
  },
  {
    slug: "backstory",
    title: "Backstory",
    hidden: false,
    blocks: [{ kind: "section", section: "backstory" }],
  },
  {
    slug: "notes",
    title: "Notes",
    hidden: false,
    blocks: [{ kind: "section", section: "notes" }],
  },
];
