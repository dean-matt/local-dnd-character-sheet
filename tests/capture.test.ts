import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capture } from "../scripts/capture.mjs";

const SCRIPTS = join(import.meta.dirname, "../scripts");

/** A `spawnSync` call with `stdio: "inherit"` on its line buffers nothing, so it passes. */
const buffers = (source: string) =>
  source
    .split("\n")
    .some(
      (line) =>
        /\bexec(File)?Sync\(/.test(line) ||
        (line.includes("spawnSync(") && !line.includes('stdio: "inherit"')),
    );

describe("capture", () => {
  it("reads output past Node's default 1 MiB buffer", () => {
    const size = 2 * 1024 * 1024;
    const out = capture(process.execPath, ["-e", `process.stdout.write("x".repeat(${size}))`]);
    expect(out.length).toBe(size);
  });

  it("is the only script that buffers a child's output", () => {
    const direct = readdirSync(SCRIPTS).filter(
      (f) => f !== "capture.mjs" && buffers(readFileSync(join(SCRIPTS, f), "utf8")),
    );
    expect(direct).toEqual([]);
  });
});
