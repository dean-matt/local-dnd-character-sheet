/**
 * The loader registry and the contract every entity loader implements.
 *
 * `build-db.ts` runs the registry in array order, and that order is the insert
 * order: a loader whose rows must land after another's — an `entities` row whose
 * FTS rank depends on an earlier one, say — goes later in the array. A loader
 * cannot read what an earlier one wrote; it only ever sees its own files, with
 * `_copy` inheritance already resolved by `copy.ts`.
 */

import { characterOptions } from "./character-options.ts";
import { classes } from "./classes.ts";
import { entityLoaders } from "./entities.ts";
import { items } from "./items.ts";
import { lookups } from "./lookups.ts";
import { races } from "./races.ts";
import { spells } from "./spells.ts";
import { tagRedirects } from "./tag-redirects.ts";

/** A column a row omits, or carries as `undefined`, is written as NULL. */
export type Row = Record<string, string | number | null | undefined>;

export type Loader = {
  name: string;
  /** Vendor-relative paths or globs. The framework reads and parses them. */
  files: string[];
  /**
   * Normalizes one parsed source between `_copy` and `_versions`, for a file
   * neither of them leaves readable. Called for every file the loader declared,
   * so one acting on a single file checks the path it was handed.
   *
   * `races.json` is the only file that needs it: a subrace's `_versions` `_mod`
   * edits traits the parent race holds, so the two merge before a version
   * expands, and the merge cannot wait for `rows`.
   */
  prepare?(parsed: unknown, path: string): unknown;
  /**
   * Maps the parsed sources, keyed by vendor-relative path, to the rows to
   * insert, keyed by table. Pure — loaders never touch the filesystem or the
   * database themselves.
   *
   * Neither `_copy` nor `_versions` survives this far. A version arrives as an
   * entry of its own, beside the one it was written under, so a loader counts
   * more entries than the file lists and needs no handling for either.
   */
  rows(sources: Map<string, unknown>): Record<string, Row[]>;
};

export const LOADERS: Loader[] = [
  spells,
  classes,
  characterOptions,
  races,
  items,
  lookups,
  tagRedirects,
  ...entityLoaders,
];
