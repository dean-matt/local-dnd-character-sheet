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
   * insert, keyed by table. No `_copy` survives this far, so an entry is
   * complete as far as that mechanism goes. `_versions` is a second, unrelated
   * inheritance mechanism carrying its own `_mod`, and it is *not* resolved —
   * `races.json` and `feats.json` have 57 of them. A loader over either has to
   * decide what to do with them. Pure — loaders never touch the filesystem or
   * the database themselves.
   */
  rows(sources: Map<string, unknown>): Record<string, Row[]>;
};

export const LOADERS: Loader[] = [];
