import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { read } from "./lib/doc-helpers.ts";

/**
 * Fence for typos.toml. The spell check has two entry points — `pnpm spell` and the
 * crate-ci/typos job — that take their arguments separately, so the config file is the
 * only place a rule reaches both.
 *
 * Every walker setting is asserted, because each one fails silently: the run stays
 * green over the paths it stopped reading. `ignore-hidden` is the one the default gets
 * wrong for this repository, and the `.ignore` pair is what keeps a file nobody
 * committed from deciding which prose a contributor checks.
 */
const WALK = {
  "ignore-hidden": false,
  "ignore-files": true,
  "ignore-vcs": true,
  "ignore-dot": false,
  "ignore-parent": true,
  "ignore-global": false,
};

const config = parse(read("typos.toml")) as {
  files?: Record<string, unknown> & { "extend-exclude"?: string[] };
};

describe("typos.toml", () => {
  it("states the walk rather than inheriting it", () => {
    expect(config.files).toMatchObject(WALK);
  });

  /** Reaching hidden paths reaches packed objects, which typos reads as prose. */
  it("excludes .git", () => {
    expect(config.files?.["extend-exclude"]).toContain(".git");
  });
});
