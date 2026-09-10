import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURE_DIR, generate } from "./build.ts";

const VENDOR = resolve(import.meta.dirname, "../../../../vendor/5etools");

/**
 * Only a checkout that has run `pnpm content:sync` can compare the two. Everyone
 * else runs the suite against the committed fixtures, which is the point of
 * committing them.
 */
describe.skipIf(!existsSync(VENDOR))("the committed fixtures", () => {
  it("are what the declaration generates from vendor/", () => {
    for (const [file, generated] of generate(VENDOR)) {
      const committed = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
      expect(generated, `${file} is stale — run pnpm fixtures:build`).toEqual(committed);
    }
  });
});
