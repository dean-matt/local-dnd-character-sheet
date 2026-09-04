/**
 * The loader registry and the contract every entity loader implements.
 *
 * `build-db.ts` runs the registry in array order, which is also dependency
 * order: a loader may rely on tables that earlier entries filled, so a new
 * loader goes after whatever it reads.
 */

export type Row = Record<string, string | number | null>;

export type Loader = {
  name: string;
  /** Vendor-relative paths or globs. The framework reads and parses them. */
  files: string[];
  /**
   * Maps the parsed sources, keyed by vendor-relative path, to the rows to
   * insert, keyed by table. Pure — loaders never touch the filesystem or the
   * database themselves.
   */
  rows(sources: Map<string, unknown>): Record<string, Row[]>;
};

export const LOADERS: Loader[] = [];
