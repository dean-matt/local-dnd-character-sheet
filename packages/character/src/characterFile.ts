import { z } from "zod";
import { characterDefinitionSchema } from "./definition.ts";
import { characterPagesSchema, PRESET_PAGES } from "./pages.ts";
import { characterStateSchema } from "./state.ts";

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
  pages: characterPagesSchema.refine(
    (pages) => PRESET_PAGES.every((preset) => pages.some((page) => page.slug === preset.slug)),
    { error: `every preset page is listed: ${PRESET_PAGES.map((page) => page.slug).join(", ")}` },
  ),
});

export type CharacterFile = z.infer<typeof characterFileSchema>;
