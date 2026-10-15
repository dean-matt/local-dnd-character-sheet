import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { characterDefinitionSchema } from "@dnd/character";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { insertCharacter } from "../db/queries/characters.ts";
import { publishEntitlementsFixture } from "../db/queries/contentFixture.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { optionalFeaturesRoutes } from "./optional-features.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const XFIGHTER = { name: "Fighter", source: "XPHB" };
const BATTLE_MASTER = { name: "Battle Master", source: "PHB" };
const MARTIAL_ADEPT = { name: "Martial Adept", source: "PHB" };
const SUPERIOR_TECHNIQUE = { name: "Superior Technique", source: "TCE" };

const definition = (overrides: Partial<z.input<typeof characterDefinitionSchema>> = {}) =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [{ class: FIGHTER }, { class: FIGHTER }, { class: FIGHTER, subclass: BATTLE_MASTER }],
    race: { name: "Elf", source: "PHB" },
    background: { name: "Acolyte", source: "PHB" },
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
    ...overrides,
  });

const byLevel = (level: number, feature_type: string, known: number) => ({
  class_name: "Fighter",
  class_source: "PHB",
  level,
  feature_type,
  known,
});

describe("optionalFeaturesRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof optionalFeaturesRoutes>;

  const entitlements = async (stored: ReturnType<typeof definition>) => {
    insertCharacter(opened.charactersDb, { id: "1", definition: stored });
    const res = await routes.request("/characters/1/optional-feature-entitlements");
    expect(res.status).toBe(200);
    return (await res.json()).entitlements;
  };

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "optional-features-routes-"));
    publishEntitlementsFixture(dataDir, {
      classes: [
        { ...FIGHTER, edition: "classic", hit_die: 10, json: "{}" },
        { ...XFIGHTER, edition: "one", hit_die: 10, json: "{}" },
      ],
      subclasses: [
        ...[FIGHTER, XFIGHTER].map((cls) => ({
          ...BATTLE_MASTER,
          short_name: "Battle Master",
          class_name: cls.name,
          class_source: cls.source,
          edition: "classic",
          json: "{}",
        })),
      ],
      classOptionalFeatures: [byLevel(1, "FS:F", 1), byLevel(2, "FS:F", 1), byLevel(3, "FS:F", 1)],
      subclassOptionalFeatures: [
        { ...byLevel(3, "MV:B", 3), subclass_name: "Battle Master", subclass_source: "PHB" },
      ],
      feats: [{ ...MARTIAL_ADEPT, edition: "classic", json: "{}" }],
      optionalFeatures: [{ ...SUPERIOR_TECHNIQUE, edition: "classic", json: "{}" }],
      grantedOptionalFeatures: [
        { granted_by: "feats", ...MARTIAL_ADEPT, feature_type: "MV:B", known: 2 },
        { granted_by: "optional_features", ...SUPERIOR_TECHNIQUE, feature_type: "MV:B", known: 1 },
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = optionalFeaturesRoutes(opened.charactersDb, dataDir);
  });

  it("reads the class and subclass rows at the level held, and a grant for each feat and option held", async () => {
    const technique = {
      ref: SUPERIOR_TECHNIQUE,
      grantedBy: { kind: "class", ref: FIGHTER },
    } as const;
    expect(
      await entitlements(
        definition({
          feats: [{ ref: MARTIAL_ADEPT, level: 3 }],
          optionalFeatures: [
            { ...technique, featureType: "FS:F" },
            { ...technique, featureType: "FS:P" },
          ],
        }),
      ),
    ).toEqual([
      {
        featureType: "FS:F",
        known: 1,
        grantedBy: { kind: "class", ref: FIGHTER },
        edition: "classic",
      },
      {
        featureType: "MV:B",
        known: 3,
        grantedBy: { kind: "subclass", ref: BATTLE_MASTER, class: FIGHTER },
        edition: "classic",
      },
      {
        featureType: "MV:B",
        known: 2,
        grantedBy: { kind: "feat", ref: MARTIAL_ADEPT },
        edition: "classic",
      },
      {
        featureType: "MV:B",
        known: 1,
        grantedBy: { kind: "optionalFeature", ref: SUPERIOR_TECHNIQUE },
        edition: "classic",
      },
    ]);
  });

  it("entitles nothing from a grantor the catalog does not hold", async () => {
    expect(
      await entitlements(
        definition({
          levels: [{ class: { homebrewId: "hb_1" } }],
          feats: [{ ref: { name: "Lost Feat", source: "PHB" } }],
        }),
      ),
    ).toEqual([]);
  });

  it("is a 404 for a character that does not exist", async () => {
    const res = await routes.request("/characters/missing/optional-feature-entitlements");
    expect(res.status).toBe(404);
  });
});
