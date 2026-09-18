import { describe, expect, it } from "vitest";
import { read } from "./lib/doc-helpers.ts";

/**
 * Fence for the one knip setting a workspace cannot do without once its only
 * *configured* entry is its own tests. A reader still reaches its surface through an
 * entry knip finds another way — an `exports` map, or a file a `package.json` script
 * names — and knip counts an entry's exports as used. Without `includeEntryExports`
 * knip reports nothing on that surface, leaving the check silent exactly where a
 * package is all surface.
 */
type KnipConfig = {
  workspaces: Record<string, { entry?: string[]; includeEntryExports?: boolean }>;
};

const TEST_ENTRY = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Repeated here so a workspace joining or leaving the set is deliberate. */
const TEST_ONLY_PACKAGES = [
  "packages/rules",
  "packages/character",
  "packages/dice",
  "packages/tags",
  "packages/catalog",
  "packages/content",
];

const config = JSON.parse(read("knip.json")) as KnipConfig;

const testOnly = Object.entries(config.workspaces).filter(
  ([, workspace]) =>
    workspace.entry !== undefined &&
    workspace.entry.length > 0 &&
    workspace.entry.every((pattern) => TEST_ENTRY.test(pattern)),
);

describe("knip.json", () => {
  it("finds exactly the workspaces whose only configured entry is their own tests", () => {
    expect(testOnly.map(([name]) => name)).toEqual(TEST_ONLY_PACKAGES);
  });

  it.each(testOnly.map(([name]) => name))("%s can report an export on its own surface", (name) => {
    expect(config.workspaces[name]?.includeEntryExports).toBe(true);
  });
});
