import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EDITION_FILES, editions } from "./edition.ts";

const FIXTURE_VENDOR = join(import.meta.dirname, "../../../../tests/fixtures/5etools");

const fixtures = (): Map<string, unknown> =>
  new Map(
    EDITION_FILES.map((path) => [
      path,
      JSON.parse(readFileSync(join(FIXTURE_VENDOR, path), "utf8")),
    ]),
  );

describe("editions", () => {
  it.each([
    ["PHB", "classic"],
    ["PaF", "classic"],
    ["XPHB", "one"],
    ["LMoP", "classic"],
    ["HotB", "one"],
  ])("resolves %s to %s", (source, edition) => {
    expect(editions(fixtures())(source)).toBe(edition);
  });

  it("falls back to classic for a source no book or adventure names", () => {
    expect(editions(fixtures())("UATheMysticClass")).toBe("classic");
  });

  it("refuses a file whose contents it cannot find", () => {
    const sources = new Map<string, unknown>([
      ["data/books.json", { book: [] }],
      ["data/adventures.json", { adventures: [] }],
    ]);

    expect(() => editions(sources)).toThrow(/data\/adventures\.json carries no adventure array/);
  });
});
