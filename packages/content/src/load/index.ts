/**
 * The loader registry and the contract every entity loader implements.
 *
 * `build-db.ts` runs the registry in array order, and that order is the insert
 * order: a loader whose rows must land after another's — an `entities` row whose
 * FTS rank depends on an earlier one, say — goes later in the array. A loader
 * cannot read what an earlier one wrote; it only ever sees its own files, with
 * `_copy` inheritance already resolved by `copy.ts`.
 */

/** A column a row omits, or carries as `undefined`, is written as NULL. */
export type Row = Record<string, string | number | null | undefined>;

export type Loader = {
  name: string;
  /** Vendor-relative paths or globs. The framework reads and parses them. */
  files: string[];
  /**
   * Maps the parsed sources, keyed by vendor-relative path, to the rows to
   * insert, keyed by table. Pure — loaders never touch the filesystem or the
   * database themselves.
   *
   * No `_copy` survives this far. `_versions` is a separate inheritance
   * mechanism with its own `_mod`, is not resolved, and reaches `races.json` and
   * `feats.json` loaders intact.
   */
  rows(sources: Map<string, unknown>): Record<string, Row[]>;
};

export const LOADERS: Loader[] = [];
