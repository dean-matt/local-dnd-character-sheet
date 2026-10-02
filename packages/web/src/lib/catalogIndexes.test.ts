import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { routeConfig } from "../router.tsx";
import { CatalogPage } from "../routes/CatalogPage.tsx";
import { CATALOG_INDEXES, catalogRowPath } from "./catalogIndexes.ts";

const leafElementType = (path: string) => {
  const matches = matchRoutes(routeConfig, path) ?? [];
  const element = matches.at(-1)?.route.element;
  return element && typeof element === "object" && "type" in element ? element.type : undefined;
};

describe("catalogRowPath", () => {
  it.each(CATALOG_INDEXES.map((index) => [index.collection]))(
    "addresses a %s row at a registered detail route",
    (collection) => {
      for (const row of [
        { name: "Mage Hand / Legerdemain", source: "XPHB" },
        { id: "a1", name: "Ember" },
      ]) {
        expect(leafElementType(catalogRowPath(collection, row))).toBe(CatalogPage);
      }
    },
  );
});
