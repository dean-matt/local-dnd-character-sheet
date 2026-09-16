import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { read } from "./lib/doc-helpers.ts";

/**
 * Fence for typos.toml. The spell check has two entry points — `pnpm spell` and the
 * crate-ci/typos job — that take their arguments separately, so the config file is the
 * only place a rule reaches both.
 *
 * Deleting `ignore-hidden` fails silently: typos then walks like ripgrep, skipping
 * .github/ and .claude/ and reporting a clean run over prose it never opened. Excluding
 * .git is its pair — reaching hidden paths reaches packed objects, which typos reads as
 * prose.
 */
const config = parse(read("typos.toml")) as {
  files?: { "ignore-hidden"?: boolean; "extend-exclude"?: string[] };
};

describe("typos.toml", () => {
  it("reads hidden paths", () => {
    expect(config.files?.["ignore-hidden"]).toBe(false);
  });

  it("excludes .git", () => {
    expect(config.files?.["extend-exclude"]).toContain(".git");
  });
});
