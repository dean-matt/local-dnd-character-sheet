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
 * wrong for this repository, and the outside-the-repository pair is the one that lets
 * a contributor's machine check less prose than the job does.
 */
const WALK = {
  "ignore-hidden": false,
  "ignore-files": true,
  "ignore-dot": true,
  "ignore-vcs": true,
  "ignore-global": false,
  "ignore-parent": false,
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
