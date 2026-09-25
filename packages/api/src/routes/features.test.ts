import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterFeatures } from "@dnd/catalog";
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { openDatabases } from "../db/client.ts";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishFeaturesFixture } from "../db/queries/contentFixture.ts";
import { insertHomebrewFeat } from "../db/queries/homebrew.ts";
import { featuresRoutes } from "./features.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const BARBARIAN = { name: "Barbarian", source: "PHB" };
const CHAMPION = { name: "Champion", source: "PHB" };
const ELF = { name: "Elf", source: "PHB" };
const ACOLYTE = { name: "Acolyte", source: "PHB" };
const ALERT = { name: "Alert", source: "PHB" };
const ARCHERY = { name: "Archery", source: "PHB" };

const json = (ref: { name: string; source: string }, extra: object = {}) =>
  JSON.stringify({ ...ref, entries: [`${ref.name} text.`], ...extra });

const classFeature = (name: string, klass: { name: string; source: string }, level: number) => ({
  name,
  source: "PHB",
  class_name: klass.name,
  class_source: klass.source,
  level,
  edition: "classic",
  json: json({ name, source: "PHB" }),
});

const definitionWith = (
  overrides: Partial<z.input<typeof characterDefinitionSchema>> = {},
): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [
      { class: FIGHTER },
      { class: FIGHTER },
      { class: FIGHTER, subclass: CHAMPION },
      { class: FIGHTER },
    ],
    race: ELF,
    subrace: { name: "High", source: "PHB" },
    background: ACOLYTE,
    abilityScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    proficiencies: {
      savingThrows: [],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [],
    spells: [],
    feats: [{ ref: ALERT, level: 4 }],
    optionalFeatures: [
      { ref: ARCHERY, featureType: "FS:F", grantedBy: { kind: "class", ref: FIGHTER } },
    ],
    ...overrides,
  });

describe("featuresRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let routes: ReturnType<typeof featuresRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const features = async (): Promise<CharacterFeatures> => {
    const res = await routes.request("/characters/1/features");
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "features-routes-"));
    opened = openDatabases(dataDir);
    routes = featuresRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
    publishFeaturesFixture(dataDir, {
      classes: [
        { ...FIGHTER, edition: "classic", hit_die: 10, json: json(FIGHTER) },
        { ...BARBARIAN, edition: "classic", hit_die: 12, json: json(BARBARIAN) },
      ],
      subclasses: [
        {
          ...CHAMPION,
          short_name: "Champion",
          class_name: "Fighter",
          class_source: "PHB",
          edition: "classic",
          json: json(CHAMPION),
        },
      ],
      classFeatures: [
        classFeature("Second Wind", FIGHTER, 1),
        classFeature("Ability Score Improvement", FIGHTER, 4),
        classFeature("Extra Attack", FIGHTER, 5),
        classFeature("Ability Score Improvement", BARBARIAN, 4),
        {
          ...classFeature("Martial Versatility", FIGHTER, 4),
          source: "TCE",
          json: json(
            { name: "Martial Versatility", source: "TCE" },
            { isClassFeatureVariant: true },
          ),
        },
      ],
      subclassFeatures: [
        {
          name: "Improved Critical",
          source: "PHB",
          class_name: "Fighter",
          class_source: "PHB",
          subclass_short_name: "Champion",
          subclass_source: "PHB",
          level: 3,
          edition: "classic",
          json: json({ name: "Improved Critical", source: "PHB" }),
        },
        {
          name: "Tactical Variant",
          source: "TCE",
          class_name: "Fighter",
          class_source: "PHB",
          subclass_short_name: "Champion",
          subclass_source: "PHB",
          level: 3,
          edition: "classic",
          json: json({ name: "Tactical Variant", source: "TCE" }, { isClassFeatureVariant: true }),
        },
      ],
      races: [{ ...ELF, edition: "classic", json: json(ELF) }],
      subraces: [
        {
          name: "High",
          source: "PHB",
          race_name: "Elf",
          race_source: "PHB",
          edition: "classic",
          json: JSON.stringify({
            name: "High",
            source: "PHB",
            entries: [
              "Unnamed prose is no trait.",
              { type: "entries", name: "Darkvision", entries: ["You see in the dark."] },
              { type: "entries", name: "Cantrip", entries: ["You know one cantrip."] },
            ],
          }),
        },
      ],
      backgrounds: [
        {
          ...ACOLYTE,
          edition: "classic",
          json: JSON.stringify({
            ...ACOLYTE,
            entries: [
              { type: "list", items: [] },
              {
                type: "entries",
                name: "Feature: Shelter of the Faithful",
                entries: ["Temples take you in."],
                data: { isFeature: true },
              },
              { type: "entries", name: "Suggested Characteristics", entries: [] },
            ],
          }),
        },
        {
          name: "Sage",
          source: "XPHB",
          edition: "one",
          json: json({ name: "Sage", source: "XPHB" }),
        },
      ],
      feats: [{ ...ALERT, edition: "classic", json: json(ALERT) }],
      optionalFeatures: [{ ...ARCHERY, edition: "classic", json: json(ARCHERY) }],
    });
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("404s an id that names no character", async () => {
    const res = await routes.request("/characters/nobody/features");
    expect(res.status).toBe(404);
  });

  it("groups every feature by what granted it, in sheet order", async () => {
    store(definitionWith());
    const { groups } = await features();

    expect(groups.map(({ origin, name }) => [origin, name])).toEqual([
      ["class", "Fighter"],
      ["subclass", "Champion"],
      ["race", "Elf (High)"],
      ["background", "Acolyte"],
      ["feat", undefined],
      ["optionalFeature", undefined],
    ]);
    expect(groups[2]?.features.map((feature) => feature.name)).toEqual(["Darkvision", "Cantrip"]);
    expect(groups[3]?.features).toEqual([
      {
        resolved: true,
        name: "Shelter of the Faithful",
        source: "PHB",
        entries: ["Temples take you in."],
      },
    ]);
    expect(groups[4]?.features).toEqual([
      { resolved: true, name: "Alert", source: "PHB", level: 4, entries: ["Alert text."] },
    ]);
    expect(groups[5]?.features).toEqual([
      {
        resolved: true,
        name: "Archery",
        source: "PHB",
        featureType: "FS:F",
        entries: ["Archery text."],
      },
    ]);
  });

  it("reads a class's features by its own key and level, never another class's", async () => {
    store(definitionWith());
    const [fighter, champion] = (await features()).groups;

    expect(fighter?.features.map(({ name, level }) => [name, level])).toEqual([
      ["Second Wind", 1],
      ["Ability Score Improvement", 4],
    ]);
    expect(fighter?.features[1]).toMatchObject({ entries: ["Ability Score Improvement text."] });
    expect(champion?.features.map(({ name, level }) => [name, level])).toEqual([
      ["Improved Critical", 3],
    ]);
  });

  it("stops each class of a multiclass character at that class's own level", async () => {
    store(
      definitionWith({
        levels: [
          { class: FIGHTER },
          { class: BARBARIAN },
          { class: BARBARIAN },
          { class: BARBARIAN },
          { class: BARBARIAN },
        ],
      }),
    );
    const groups = (await features()).groups.filter(({ origin }) => origin === "class");

    expect(groups.map(({ name, features }) => [name, features.map((f) => f.name)])).toEqual([
      ["Fighter", ["Second Wind"]],
      ["Barbarian", ["Ability Score Improvement"]],
    ]);
  });

  it("adds Tasha's optional class features only where the table opted into them", async () => {
    store(definitionWith({ houseRules: { optionalClassFeatures: true } }));
    const [fighter, champion] = (await features()).groups;

    expect(fighter?.features.map(({ name }) => name)).toEqual([
      "Second Wind",
      "Ability Score Improvement",
      "Martial Versatility",
    ]);
    expect(champion?.features.map(({ name }) => name)).toEqual([
      "Improved Critical",
      "Tactical Variant",
    ]);
  });

  it("marks a reference that resolves to nothing rather than dropping it", async () => {
    store(
      definitionWith({
        levels: [{ class: { name: "Artificer", source: "TCE" } }],
        race: { name: "Owlin", source: "SCC" },
        subrace: undefined,
        feats: [{ ref: { name: "Lucky", source: "PHB" } }],
        optionalFeatures: [
          {
            ref: { homebrewId: "gone" },
            featureType: "EI",
            grantedBy: { kind: "class", ref: FIGHTER },
          },
        ],
      }),
    );
    const { groups } = await features();

    expect(groups).toEqual([
      {
        origin: "class",
        name: "Artificer",
        features: [{ resolved: false, name: "Artificer", source: "TCE" }],
      },
      {
        origin: "race",
        name: "Owlin",
        features: [{ resolved: false, name: "Owlin", source: "SCC" }],
      },
      expect.objectContaining({ origin: "background" }),
      { origin: "feat", features: [{ resolved: false, name: "Lucky", source: "PHB" }] },
      {
        origin: "optionalFeature",
        features: [{ resolved: false, name: "Homebrew", featureType: "EI" }],
      },
    ]);
  });

  it("resolves a homebrew feat and leaves out a background that flags no feature", async () => {
    insertHomebrewFeat(opened.homebrewDb, "hb", {
      name: "Tavern Brawler Plus",
      edition: "classic",
      entries: ["You brawl."],
    });
    store(
      definitionWith({
        background: { name: "Sage", source: "XPHB" },
        feats: [{ ref: { homebrewId: "hb" } }],
        optionalFeatures: [],
      }),
    );
    const { groups } = await features();

    expect(groups.map(({ origin }) => origin)).toEqual(["class", "subclass", "race", "feat"]);
    expect(groups[3]?.features).toEqual([
      { resolved: true, name: "Tavern Brawler Plus", source: "HB", entries: ["You brawl."] },
    ]);
  });
});
