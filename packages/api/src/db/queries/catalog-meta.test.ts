import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCatalogMeta, getCatalogSources, getCatalogVersion } from "./catalog-meta.ts";
import { publishMeta, publishSearchFixture } from "./contentFixture.ts";

describe("getCatalogMeta", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns the meta rows once a catalog has been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-meta-"));
    publishMeta(dataDir, [
      { key: "upstream_tag", value: "v2.34.1" },
      { key: "built_at", value: "2026-01-01T00:00:00.000Z" },
    ]);

    expect(getCatalogMeta(dataDir)).toEqual([
      { key: "built_at", value: "2026-01-01T00:00:00.000Z" },
      { key: "upstream_tag", value: "v2.34.1" },
    ]);
  });

  it("returns undefined when no catalog has ever been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-meta-"));
    expect(getCatalogMeta(dataDir)).toBeUndefined();
  });
});

describe("getCatalogVersion", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("reads the upstream tag out of the meta rows", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-version-"));
    publishMeta(dataDir, [{ key: "upstream_tag", value: "v2.34.1" }]);

    expect(getCatalogVersion(dataDir)).toBe("v2.34.1");
  });

  it("is undefined before a catalog has been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-version-"));
    expect(getCatalogVersion(dataDir)).toBeUndefined();
  });
});

const volume = (type: string, name: string, source: string) => ({
  type,
  name,
  source,
  qualifier: "",
  edition: null,
  json: JSON.stringify({ name, source }),
  rendered_text: name,
});

describe("getCatalogSources", () => {
  let dataDir: string;

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("titles each source once, preferring the book where an adventure shares its source", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-sources-"));
    publishSearchFixture(dataDir, {
      entities: [
        volume("book", "Player's Handbook (2014)", "PHB"),
        volume("adventure", "Theros: No Silent Secret", "MOT"),
        volume("book", "Mythic Odysseys of Theros", "MOT"),
        volume("adventure", "Curse of Strahd", "CoS"),
        volume("monster", "Goblin", "MM"),
      ],
    });

    expect(getCatalogSources(dataDir)).toEqual([
      { source: "CoS", name: "Curse of Strahd" },
      { source: "MOT", name: "Mythic Odysseys of Theros" },
      { source: "PHB", name: "Player's Handbook (2014)" },
    ]);
  });

  it("is undefined before a catalog has been built", () => {
    dataDir = mkdtempSync(join(tmpdir(), "catalog-sources-"));
    expect(getCatalogSources(dataDir)).toBeUndefined();
  });
});
