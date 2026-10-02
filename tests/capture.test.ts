import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capture } from "../scripts/capture.mjs";

const SCRIPTS = join(import.meta.dirname, "../scripts");

describe("capture", () => {
  it("reads output past Node's default 1 MiB buffer", () => {
    const size = 2 * 1024 * 1024;
    const out = capture(process.execPath, ["-e", `process.stdout.write("x".repeat(${size}))`]);
    expect(out.length).toBe(size);
  });

  it("is the only script that buffers a child with execFileSync", () => {
    const direct = readdirSync(SCRIPTS).filter(
      (f) => f !== "capture.mjs" && readFileSync(join(SCRIPTS, f), "utf8").includes("execFileSync"),
    );
    expect(direct).toEqual([]);
  });
});
