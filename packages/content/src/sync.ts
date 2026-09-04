/**
 * Fetches upstream 5etools data into `vendor/5etools/` and records what it took.
 *
 * The data is never committed (see NOTICE), so `content.lock.json` is what makes
 * a fetch reproducible: it pins the upstream tag and the SHA-256 of every file
 * copied. Files are copied byte-for-byte, so a lock hash equals the upstream
 * file's hash and any mismatch means a real upstream change or a corrupt fetch.
 *
 *   pnpm content:sync                 fetch the tag in content.manifest.json
 *   pnpm content:sync --tag v2.35.0   fetch a different tag and rewrite the lock
 *   pnpm content:sync --verify        check vendor/ against the lock, fetch nothing
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../..");
const MANIFEST = join(ROOT, "content.manifest.json");
const LOCKFILE = join(ROOT, "content.lock.json");

type Manifest = { repo: string; tag: string; include: string[]; dest: string };
type Lock = { tag: string; fetchedAt: string; files: Record<string, string> };

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Lock keys are always forward-slashed so a lockfile is portable across platforms. */
export function posix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

async function hashTree(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const abs = join(entry.parentPath, entry.name);
    files[posix(relative(dir, abs))] = createHash("sha256").update(readFileSync(abs)).digest("hex");
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

/** Throws unless `vendor/` matches the lockfile. Returns the directory it verified. */
export async function verifyVendor(): Promise<string> {
  const { dest }: Manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const dir = join(ROOT, dest);
  let lock: Lock;
  try {
    lock = JSON.parse(readFileSync(LOCKFILE, "utf8"));
  } catch {
    throw new Error("No content.lock.json. Run `pnpm content:sync` first.");
  }
  if (!existsSync(dir)) {
    throw new Error(
      `${relative(ROOT, dir)} does not exist. Run \`pnpm content:sync\` to fetch it.`,
    );
  }
  const actual = await hashTree(dir);
  const drifted = Object.keys(lock.files).filter((f) => actual[f] !== lock.files[f]);
  const extra = Object.keys(actual).filter((f) => !(f in lock.files));
  if (drifted.length || extra.length) {
    throw new Error(
      `vendor/ does not match content.lock.json (tag ${lock.tag}):\n` +
        `  ${drifted.length} changed or missing, ${extra.length} unexpected\n` +
        "Run `pnpm content:sync` to restore it.",
    );
  }
  console.log(
    `vendor/ matches content.lock.json — ${Object.keys(actual).length} files, tag ${lock.tag}`,
  );
  return dir;
}

async function sync(manifest: Manifest, tag: string, dest: string): Promise<void> {
  const temp = mkdtempSync(join(tmpdir(), "5etools-"));
  try {
    console.log(`Cloning ${manifest.repo} at ${tag}...`);
    git(["clone", "--depth", "1", "--branch", tag, "--filter=blob:none", manifest.repo, temp]);

    const staging = `${dest}.incoming`;
    rmSync(staging, { recursive: true, force: true });
    for (const dir of manifest.include) {
      cpSync(join(temp, dir), join(staging, dir), { recursive: true });
    }
    rmSync(dest, { recursive: true, force: true });
    renameSync(staging, dest);

    const files = await hashTree(dest);
    const lock: Lock = { tag, fetchedAt: new Date().toISOString(), files };
    writeFileSync(LOCKFILE, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Fetched ${Object.keys(files).length} files to ${relative(ROOT, dest)}`);
    console.log("Wrote content.lock.json. Next: pnpm content:build");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--verify")) {
    await verifyVendor();
    return;
  }

  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const tagFlag = args.indexOf("--tag");
  const tag = tagFlag === -1 ? manifest.tag : args[tagFlag + 1];

  if (!tag) throw new Error("--tag requires a value");

  await sync(manifest, tag, join(ROOT, manifest.dest));
  if (tag !== manifest.tag) {
    writeFileSync(MANIFEST, `${JSON.stringify({ ...manifest, tag }, null, 2)}\n`);
    console.log(`Updated content.manifest.json to ${tag}`);
  }
}

// Only run when invoked as a script. Without this guard, importing anything from
// this module — a test, for one — performs a full 109 MB fetch.
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
