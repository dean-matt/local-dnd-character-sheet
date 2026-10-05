import type { CatalogSource } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { shelveSources } from "./sourceShelves.ts";

const catalog = new Map<string, CatalogSource>(
  [
    { source: "PHB", name: "Player's Handbook (2014)", group: "core" },
    { source: "XGE", name: "Xanathar's Guide to Everything", group: "supplement" },
    { source: "MaBJoV", name: "Minsc and Boo's Journal of Villainy", group: "supplement-alt" },
    { source: "PSZ", name: "Plane Shift: Zendikar", group: "setting-alt" },
    { source: "CoS", name: "Curse of Strahd", group: "adventure" },
    { source: "Screen", name: "Dungeon Master's Screen", group: "screen" },
    { source: "HF", name: "Heroes' Feast", group: "recipe" },
  ].map((row) => [row.source, row]),
);

const ALL = ["CoS", "HF", "MaBJoV", "PHB", "PSZ", "Screen", "TftYP", "UATheMysticClass", "XGE"];

const labelsAndSources = (query: string) =>
  shelveSources(ALL, catalog, query).map(({ label, sources }) => [
    label,
    sources.map(({ source }) => source),
  ]);

describe("shelveSources", () => {
  it("files each source under its group, playtest by prefix, and the rest under Other", () => {
    expect(labelsAndSources("")).toEqual([
      ["Core rulebooks", ["PHB"]],
      ["Supplements", ["MaBJoV", "XGE"]],
      ["Settings", ["PSZ"]],
      ["Adventures", ["CoS"]],
      ["Screens", ["Screen"]],
      ["Playtest", ["UATheMysticClass"]],
      ["Other", ["HF", "TftYP"]],
    ]);
  });

  it("matches the abbreviation or the title, ignoring case, and drops emptied groups", () => {
    expect(labelsAndSources("  phb ")).toEqual([["Core rulebooks", ["PHB"]]]);
    expect(labelsAndSources("GUIDE")).toEqual([["Supplements", ["XGE"]]]);
    expect(labelsAndSources("strahd")).toEqual([["Adventures", ["CoS"]]]);
    expect(labelsAndSources("nothing like it")).toEqual([]);
  });

  it("files every source under Other before the titles arrive, playtest aside", () => {
    expect(
      shelveSources(["PHB", "UATheMysticClass"], undefined, "").map(({ label }) => label),
    ).toEqual(["Playtest", "Other"]);
  });
});
