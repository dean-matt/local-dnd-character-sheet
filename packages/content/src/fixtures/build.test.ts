import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generate, stale } from "./build.ts";

const VENDOR = resolve(import.meta.dirname, "../../../../vendor/5etools");

/**
 * Only a checkout that has run `pnpm content:sync` can compare the two. Everyone
 * else runs the suite against the committed fixtures, which is the point of
 * committing them.
 */
describe.skipIf(!existsSync(VENDOR))("the committed fixtures", () => {
  it("are what the declaration generates from vendor/", () => {
    expect(stale(generate(VENDOR)), "run pnpm fixtures:build").toEqual([]);
  });
});
