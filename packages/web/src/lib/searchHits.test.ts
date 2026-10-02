import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { routeConfig } from "../router.tsx";
import { CatalogPage } from "../routes/CatalogPage.tsx";
import { HIT_COLLECTIONS, searchHitPath, searchHitTypeLabel } from "./searchHits.ts";

const leafElementType = (path: string) => {
  const matches = matchRoutes(routeConfig, path) ?? [];
  const element = matches.at(-1)?.route.element;
  return element && typeof element === "object" && "type" in element ? element.type : undefined;
};

describe("searchHitPath", () => {
  it("addresses a catalog hit by its encoded name and source", () => {
    const hit = { type: "item", name: "+1 Longsword", source: "DMG", edition: "classic" as const };
    expect(searchHitPath(hit)).toBe("/catalog/items/%2B1%20Longsword/DMG");
  });

  it("addresses a homebrew hit by its id", () => {
    expect(searchHitPath({ type: "spell", id: "7", name: "Ember", edition: "one" })).toBe(
      "/catalog/homebrew/spells/7",
    );
  });

  it.each([...HIT_COLLECTIONS.keys()])(
    "addresses a %s hit at a registered detail route",
    (type) => {
      const path = searchHitPath({
        type,
        name: "Mage Hand / Legerdemain",
        source: "XPHB",
        edition: "one",
      });
      expect(leafElementType(path ?? "")).toBe(CatalogPage);
    },
  );

  it.each(["item", "spell"] as const)(
    "addresses a homebrew %s hit at a registered detail route",
    (type) => {
      const path = searchHitPath({ type, id: "a1", name: "Ember", edition: "one" });
      expect(leafElementType(path ?? "")).toBe(CatalogPage);
    },
  );

  it.each(["monster", "constructor"])("has no path for the type %s", (type) => {
    expect(
      searchHitPath({ type, name: "Fire Giant", source: "MM", edition: null }),
    ).toBeUndefined();
  });
});

describe("searchHitTypeLabel", () => {
  it.each([
    ["spell", "Spell"],
    ["optfeature", "Optional feature"],
    ["legendaryGroup", "Legendary group"],
  ])("labels %s as %s", (type, label) => {
    expect(searchHitTypeLabel(type)).toBe(label);
  });
});
