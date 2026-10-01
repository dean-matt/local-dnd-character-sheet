/**
 * A scratch content directory per test, built from the fixture corpus or from a
 * vendor directory holding one hand-written class file beside the files the
 * classes loader declares.
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach } from "vitest";
import { buildContent, resolveContentDb } from "../build-db.ts";
import { OPTIONAL_FEATURES_FILE } from "../load/character-options.ts";
import { classes } from "../load/classes.ts";
import { EDITION_FILES } from "../load/edition.ts";
import type { Loader } from "../load/index.ts";

export const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

/** The cell at level 1, and 19 levels of zero after it — a table is all 20. */
export const table = (...cells: unknown[]): unknown[][] => [
  cells,
  ...Array.from({ length: 19 }, () => cells.map(() => 0)),
];

/** Registers the per-test workspace hooks, so call it inside a `describe`. */
export function classesWorkspace() {
  let workspace = "";
  const contentDir = () => join(workspace, "data", "content");

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "content-classes-"));
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  const build = (vendorDir: string, loaders: Loader[] = [classes]) =>
    buildContent({ vendorDir, contentDir: contentDir(), loaders, meta: {} });

  const open = (): Database.Database =>
    new Database(resolveContentDb(contentDir()), { readonly: true });

  const vendorHolding = (file: string, contents: unknown): string => {
    const vendorDir = join(workspace, "vendor");
    mkdirSync(join(vendorDir, "data", "class"), { recursive: true });
    writeFileSync(join(vendorDir, "data", "class", file), JSON.stringify(contents));
    writeFileSync(
      join(vendorDir, "data", "class", "fluff-class-test.json"),
      JSON.stringify({ classFluff: [], subclassFluff: [] }),
    );
    for (const path of [...EDITION_FILES, OPTIONAL_FEATURES_FILE]) {
      const destination = join(vendorDir, path);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(FIXTURE_VENDOR, path), destination);
    }
    return vendorDir;
  };

  /**
   * The reason, not the wrapper. `buildContent` reports every failure as
   * `Loader "classes" failed`, including a vendor directory missing a file the
   * loader declared, so asserting the wrapper passes whether or not the entry
   * was refused for the stated reason.
   */
  const refusal = (vendorDir: string): string => {
    try {
      build(vendorDir);
    } catch (error) {
      const { cause } = error as Error;
      return cause instanceof Error ? cause.message : String(cause);
    }
    throw new Error("the build succeeded");
  };

  return { build, open, vendorHolding, refusal };
}
