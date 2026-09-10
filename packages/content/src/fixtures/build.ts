/**
 * Regenerates `tests/fixtures/5etools/` from `vendor/5etools/`.
 *
 * The fixtures are committed and `vendor/` is not, so a contributor with no
 * `vendor/` still runs the whole suite. Regenerating needs the pinned tag, which
 * is why this verifies the lockfile before it reads anything.
 *
 *   pnpm fixtures:build            rewrite every fixture from the pinned tag
 *   pnpm fixtures:build --check    fail if a rewrite would change anything
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { posix, verifyVendor } from "../sync.ts";
import { FIXTURES } from "./declaration.ts";
import { select } from "./select.ts";

const ROOT = resolve(import.meta.dirname, "../../../..");
export const FIXTURE_DIR = join(ROOT, "tests/fixtures/5etools");

/** Every fixture, as the parsed document it should hold. */
export function generate(vendorDir: string): Map<string, unknown> {
  return new Map(
    FIXTURES.map(({ file, keep }) => {
      const upstream = JSON.parse(readFileSync(join(vendorDir, file), "utf8"));
      return [file, select(upstream, keep, file)];
    }),
  );
}

/** Biome owns the formatting of every committed file, fixtures included. */
function format(paths: string[]): void {
  execFileSync("pnpm", ["exec", "biome", "format", "--write", ...paths], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/** Everything committed under the fixture tree, as paths relative to it. */
function committedFixtures(): string[] {
  if (!existsSync(FIXTURE_DIR)) return [];
  return readdirSync(FIXTURE_DIR, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => posix(relative(FIXTURE_DIR, join(entry.parentPath, entry.name))));
}

/**
 * The fixtures that no longer say what the declaration generates, orphans included —
 * a file the declaration has stopped naming is the value nobody can source that this
 * whole arrangement exists to prevent. Formatting is Biome's, so the comparison parses.
 */
export function stale(generated: Map<string, unknown>): string[] {
  const drifted = [...generated]
    .filter(([file, document]) => {
      const path = join(FIXTURE_DIR, file);
      if (!existsSync(path)) return true;
      const committed = JSON.parse(readFileSync(path, "utf8"));
      return JSON.stringify(committed) !== JSON.stringify(document);
    })
    .map(([file]) => file);
  const orphans = committedFixtures().filter((file) => !generated.has(file));
  return [...drifted, ...orphans.map((file) => `${file} (no longer declared)`)];
}

async function main(): Promise<void> {
  const { dir, tag } = await verifyVendor();
  const generated = generate(dir);

  if (process.argv.slice(2).includes("--check")) {
    const drifted = stale(generated);
    if (drifted.length > 0) {
      throw new Error(
        `Not what the declaration generates at ${tag}. Run \`pnpm fixtures:build\`:\n` +
          drifted.map((file) => `  ${file}`).join("\n"),
      );
    }
    console.log(`${generated.size} fixtures match the declaration at ${tag}`);
    return;
  }

  for (const file of committedFixtures().filter((name) => !generated.has(name))) {
    rmSync(join(FIXTURE_DIR, file));
    console.log(`Removed ${file}, which the declaration no longer names`);
  }

  const written = [...generated].map(([file, document]) => {
    const path = join(FIXTURE_DIR, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
    return path;
  });
  format(written);
  console.log(`Wrote ${written.length} fixtures from ${tag}`);
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === import.meta.filename
) {
  await main();
}
