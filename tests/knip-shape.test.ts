import { describe, expect, it } from "vitest";
import { read } from "./lib/doc-helpers.ts";

/**
 * Fence for the one knip setting a leaf package cannot do without. Where a workspace's
 * only entry is its own tests, a reader reaches everything else through the entry its
 * `exports` map declares — and knip counts an entry's exports as used. Without
 * `includeEntryExports` knip reports nothing on such a package's surface, leaving the
 * check silent exactly where a package is all surface.
 */
type KnipConfig = {
  workspaces: Record<string, { entry?: string[]; includeEntryExports?: boolean }>;
};

const TEST_ENTRY = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

const config = JSON.parse(read("knip.json")) as KnipConfig;

const testOnly = Object.entries(config.workspaces).filter(
  ([, workspace]) =>
    workspace.entry !== undefined &&
    workspace.entry.length > 0 &&
    workspace.entry.every((pattern) => TEST_ENTRY.test(pattern)),
);

describe("knip.json", () => {
  it("finds workspaces whose only entry is their own tests", () => {
    expect(testOnly.length).toBeGreaterThan(0);
  });

  it.each(testOnly.map(([name]) => name))("%s can report an export on its own surface", (name) => {
    expect(config.workspaces[name]?.includeEntryExports).toBe(true);
  });
});
