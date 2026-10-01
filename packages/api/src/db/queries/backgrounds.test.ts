import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBackground, listBackgrounds } from "./backgrounds.ts";
import { publishBackgrounds } from "./contentFixture.ts";

const ACOLYTE = {
  name: "Acolyte",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Acolyte", source: "PHB" }),
};

describe("content background queries", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-backgrounds-"));
    publishBackgrounds(dataDir, [ACOLYTE]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists backgrounds filtered to one edition", () => {
    expect(listBackgrounds(dataDir, "classic")).toEqual([ACOLYTE]);
    expect(listBackgrounds(dataDir, "one")).toEqual([]);
  });

  it("reads one background by name and source", () => {
    expect(getBackground(dataDir, "Acolyte", "PHB")).toEqual(ACOLYTE);
    expect(getBackground(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});
