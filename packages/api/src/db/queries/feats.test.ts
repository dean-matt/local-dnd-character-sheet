import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publishFeats } from "./contentFixture.ts";
import { getFeat, listFeats } from "./feats.ts";

const ALERT = {
  name: "Alert",
  source: "PHB",
  edition: "classic",
  json: JSON.stringify({ name: "Alert", source: "PHB" }),
};

describe("content feat queries", () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "content-feats-"));
    publishFeats(dataDir, [ALERT]);
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("lists feats filtered to one edition", () => {
    expect(listFeats(dataDir, "classic")).toEqual([ALERT]);
    expect(listFeats(dataDir, "one")).toEqual([]);
  });

  it("reads one feat by name and source", () => {
    expect(getFeat(dataDir, "Alert", "PHB")).toEqual(ALERT);
    expect(getFeat(dataDir, "Nonexistent", "PHB")).toBeUndefined();
  });
});
