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
 * A file exported before Backstory had a preset page lacks it, and gains the stock page just
 * before Notes, where the migration that added it puts it on a stored character.
 */
function withBackstoryPage(pages: unknown): unknown {
  if (!Array.isArray(pages)) return pages;
  const isSlug = (slug: string) => (page: unknown) =>
    typeof page === "object" && page !== null && "slug" in page && page.slug === slug;
  if (pages.some(isSlug("backstory"))) return pages;
  const stock = PRESET_PAGES.find((page) => page.slug === "backstory");
  const notes = pages.findIndex(isSlug("notes"));
  const at = notes === -1 ? pages.length : notes;
  return [...pages.slice(0, at), stock, ...pages.slice(at)];
}

/**
 * A character as one file: what an export writes and an import reads. Catalog and
 * homebrew references stay as the definition holds them, so a file names rows rather
 * than carrying them, and imports whether or not they resolve here. A file names its
 * `version`, so a later shape can tell an older file apart rather than misread it.
 * `preset` is left out, since an import marks a page preset by its slug.
 */
export const characterFileSchema = z.strictObject({
  format: z.literal("local-dnd-character-sheet/character"),
  version: z.literal(1),
  definition: characterDefinitionSchema,
  state: characterStateSchema,
  pages: z.preprocess(
    (pages) => withBackstoryPage(withoutAlignmentPage(pages)),
    characterPagesSchema.refine(
      (pages) => PRESET_PAGES.every((preset) => pages.some((page) => page.slug === preset.slug)),
      { error: `every preset page is listed: ${PRESET_PAGES.map((page) => page.slug).join(", ")}` },
    ),
  ),
});

export type CharacterFile = z.infer<typeof characterFileSchema>;
