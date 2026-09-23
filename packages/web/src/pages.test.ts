import { describe, expect, it } from "vitest";
import {
  type CharacterPageSummary,
  findCharacterPage,
  getCharacterPages,
  visiblePages,
} from "./pages.ts";

describe("getCharacterPages", () => {
  it("returns the same preset pages for any character, in a fixed order", () => {
    expect(getCharacterPages("a")).toEqual(getCharacterPages("b"));
    expect(getCharacterPages("a").map((page) => page.slug)).toEqual([
      "stats",
      "spells",
      "inventory",
      "features",
    ]);
  });
});

describe("findCharacterPage", () => {
  it("finds a page by slug", () => {
    expect(findCharacterPage("a", "spells")?.title).toBe("Spells");
  });

  it("returns undefined for a slug that names no page", () => {
    expect(findCharacterPage("a", "nonsense")).toBeUndefined();
  });
});

describe("visiblePages", () => {
  const pages: CharacterPageSummary[] = [
    { slug: "one", title: "One", hidden: false },
    { slug: "two", title: "Two", hidden: true },
    { slug: "three", title: "Three", hidden: false },
  ];

  it("drops hidden pages while keeping the rest in order", () => {
    expect(visiblePages(pages).map((page) => page.slug)).toEqual(["one", "three"]);
  });
});
