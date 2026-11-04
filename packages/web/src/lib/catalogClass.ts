import { HOMEBREW_SOURCE } from "@dnd/catalog";
import type { ContentRef, EntryRef } from "@dnd/character";

/**
 * `cls` where it names a catalog class. A homebrew class cited by its id or by
 * `(name, "HB")` has no catalog row to read.
 */
export const catalogClass = (cls: EntryRef): ContentRef | undefined =>
  "name" in cls && cls.source.toUpperCase() !== HOMEBREW_SOURCE ? cls : undefined;

/** `cls` where it cites a homebrew class by `(name, "HB")` rather than by id. */
export const homebrewClassByName = (cls: EntryRef): ContentRef | undefined =>
  "name" in cls && cls.source.toUpperCase() === HOMEBREW_SOURCE ? cls : undefined;
