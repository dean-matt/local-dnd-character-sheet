import { z } from "zod";
import { characterDefinitionSchema } from "./definition.ts";
import { characterPagesSchema, PRESET_PAGES } from "./pages.ts";
import { characterStateSchema } from "./state.ts";

const isAlignmentSection = (block: unknown) =>
  typeof block === "object" &&
  block !== null &&
  "kind" in block &&
  block.kind === "section" &&
  "section" in block &&
  block.section === "alignment";

/**
 * A file exported while Alignment had a preset page of its own still lists that page. The
 * stock page goes, as the migration that removed it drops it; an edited one stays as a page
 * of the user's, its alignment section degraded to `unknown` the way a database read
 * degrades it.
 */
function withoutAlignmentPage(pages: unknown): unknown {
  if (!Array.isArray(pages)) return pages;
  return pages.flatMap((page) => {
    if (typeof page !== "object" || page === null || !Array.isArray(page.blocks)) return [page];
    const { blocks } = page as { blocks: unknown[] };
    const stock =
      page.slug === "alignment" &&
      page.title === "Alignment" &&
      blocks.length === 1 &&
      isAlignmentSection(blocks[0]);
    if (stock) return [];
    return [
      {
        ...page,
        blocks: blocks.map((block) =>
          isAlignmentSection(block) ? { kind: "unknown", raw: block } : block,
        ),
      },
    ];
  });
}

/**
 * A version 1 file predates the Backstory preset, so a page it holds under `backstory` is
 * the user's own. That page moves to the slug plus a random suffix, as the migration that
 * added the preset moves one, rather than becoming a preset that restoring the defaults
 * would overwrite. The stock page goes just before Notes, where the migration puts it.
 */
function withBackstoryPage(pages: unknown): unknown {
  if (!Array.isArray(pages)) return pages;
  const isSlug = (slug: string) => (page: unknown) =>
    typeof page === "object" && page !== null && "slug" in page && page.slug === slug;
  const renamed = pages.map((page) =>
    isSlug("backstory")(page)
      ? { ...page, slug: `backstory-${crypto.randomUUID().slice(0, 8)}` }
      : page,
  );
  const stock = PRESET_PAGES.find((page) => page.slug === "backstory");
  const notes = renamed.findIndex(isSlug("notes"));
  const at = notes === -1 ? renamed.length : notes;
  return [...renamed.slice(0, at), stock, ...renamed.slice(at)];
}

/** Reads a version 1 file as the version 2 it would be, written today. */
function fromVersionOne(file: unknown): unknown {
  if (typeof file !== "object" || file === null || !("version" in file) || file.version !== 1) {
    return file;
  }
  const { pages } = file as { pages?: unknown };
  return { ...file, version: 2, pages: withBackstoryPage(withoutAlignmentPage(pages)) };
}

/**
 * A character as one file: what an export writes and an import reads. Catalog and
 * homebrew references stay as the definition holds them, so a file names rows rather
 * than carrying them, and imports whether or not they resolve here. A file names its
 * `version`, so a later shape can tell an older file apart rather than misread it.
 * `preset` is left out, since an import marks a page preset by its slug.
 */
export const characterFileSchema = z.preprocess(
  fromVersionOne,
  z.strictObject({
    format: z.literal("local-dnd-character-sheet/character"),
    version: z.literal(2),
    definition: characterDefinitionSchema,
    state: characterStateSchema,
    pages: characterPagesSchema,
  }),
);

export type CharacterFile = z.infer<typeof characterFileSchema>;
