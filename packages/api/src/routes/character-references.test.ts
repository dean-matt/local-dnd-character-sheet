import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CharacterSpells } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type CharacterReferences,
  characterDefinitionSchema,
  defaultCharacterState,
} from "@dnd/character";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { insertCharacter, updateCharacterState } from "../db/queries/characters.ts";
import { publishReferencesFixture, type ReferencesFixture } from "../db/queries/contentFixture.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { characterReferencesRoutes } from "./character-references.ts";
import { characterSpellsRoutes } from "./character-spells.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const CHAMPION = { name: "Champion", source: "PHB" };
const ELF = { name: "Elf", source: "PHB" };
const HIGH = { name: "High", source: "PHB" };
const ACOLYTE = { name: "Acolyte", source: "PHB" };
const ATHLETICS = { name: "Athletics", source: "PHB" };
const COMMON = { name: "Common", source: "PHB" };
const LONGSWORD = { name: "Longsword", source: "PHB" };
const PLUS_ONE = { name: "+1 Weapon", source: "DMG" };
const SHIELD = { name: "Shield", source: "PHB" };
const ALERT = { name: "Alert", source: "PHB" };
const ARCHERY = { name: "Archery", source: "PHB" };
const TYR = { name: "Tyr", source: "PHB", pantheon: "Forgotten Realms" };

const spellRow = (ref: { name: string; source: string }) => ({
  ...ref,
  edition: "classic",
  level: 1,
  school: "A",
  concentration: 0 as const,
  ritual: 0 as const,
  json: JSON.stringify({ ...ref, level: 1, school: "A" }),
});

const itemRow = (ref: { name: string; source: string }, kind: string, json: object) => ({
  ...ref,
  edition: "classic",
  kind,
  type: null,
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ ...ref, ...json }),
});

const PLUS_ONE_ROW = itemRow(PLUS_ONE, "magicvariant", {
  requires: [{ weapon: true }],
  inherits: { namePrefix: "+1 ", source: "DMG", rarity: "uncommon" },
});

/** Every row `definitionWith()` names, so each test removes or adds only what it asserts. */
const CATALOG: ReferencesFixture = {
  classes: [FIGHTER],
  subclasses: [{ ...CHAMPION, class_name: "Fighter", class_source: "PHB" }],
  races: [ELF],
  subraces: [{ ...HIGH, race_name: "Elf", race_source: "PHB" }],
  backgrounds: [ACOLYTE],
  items: [itemRow(LONGSWORD, "baseitem", { weapon: true }), PLUS_ONE_ROW],
  spells: [spellRow(SHIELD)],
  feats: [ALERT],
  optionalFeatures: [ARCHERY],
  lookups: [
    { ...ATHLETICS, kind: "skill", qualifier: "" },
    { ...COMMON, kind: "language", qualifier: "" },
    { name: TYR.name, source: TYR.source, kind: "deity", qualifier: TYR.pantheon },
  ],
};

const definitionWith = (
  overrides: Partial<z.input<typeof characterDefinitionSchema>> = {},
): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [{ class: FIGHTER }, { class: FIGHTER }, { class: FIGHTER, subclass: CHAMPION }],
    race: ELF,
    subrace: HIGH,
    background: ACOLYTE,
    abilityScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    proficiencies: {
      savingThrows: [],
      skills: [{ ref: ATHLETICS, level: "proficient" }],
      armor: [],
      weapons: [],
      tools: [],
      languages: [COMMON],
    },
    inventory: [{ ref: LONGSWORD, variant: PLUS_ONE }],
    spells: [{ ref: SHIELD, origin: FIGHTER }],
    feats: [
      {
        ref: ALERT,
        level: 3,
        grantedBy: { kind: "subclass", ref: CHAMPION, class: FIGHTER },
      },
    ],
    optionalFeatures: [
      { ref: ARCHERY, featureType: "FS:F", grantedBy: { kind: "class", ref: FIGHTER } },
    ],
    deity: TYR,
    ...overrides,
  });

describe("characterReferencesRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const unresolved = async (): Promise<CharacterReferences["unresolved"]> => {
    const routes = characterReferencesRoutes(opened.charactersDb, dataDir);
    const res = await routes.request("/characters/1/references");
    expect(res.status).toBe(200);
    return (await res.json()).unresolved;
  };

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "character-references-"));
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("404s an id that names no character", async () => {
    publishReferencesFixture(dataDir, CATALOG);
    const routes = characterReferencesRoutes(opened.charactersDb, dataDir);
    expect((await routes.request("/characters/nobody/references")).status).toBe(404);
  });

  it("reports nothing where every field resolves", async () => {
    publishReferencesFixture(dataDir, CATALOG);
    store(definitionWith());
    expect(await unresolved()).toEqual([]);
  });

  it("renders a spell the catalog dropped and reports it by field", async () => {
    publishReferencesFixture(dataDir, { ...CATALOG, spells: [] });
    store(definitionWith());

    const spells = characterSpellsRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
    const res = await spells.request("/characters/1/spells");
    expect(res.status).toBe(200);
    const body: CharacterSpells = await res.json();
    expect(body.spells).toEqual([
      { resolved: false, name: "Shield", source: "PHB", prepared: false, origin: FIGHTER },
    ]);

    expect(await unresolved()).toEqual([{ field: "spells[0].ref", kind: "spell", ref: SHIELD }]);
  });

  it("reports the row a renamed reference became, spelled as the row spells it", async () => {
    publishReferencesFixture(dataDir, {
      ...CATALOG,
      feats: [{ name: "Alert", source: "XPHB" }],
      tagRedirects: [
        { tag: "feats.html", from_key: "alert_phb", to_tag: "feats.html", to_key: "alert_xphb" },
      ],
    });
    store(definitionWith());
    expect(await unresolved()).toEqual([
      {
        field: "feats[0].ref",
        kind: "feat",
        ref: ALERT,
        renamedTo: { name: "Alert", source: "XPHB" },
      },
    ]);
  });

  it("calls a reference dangling where its redirect lands in another table or on nothing", async () => {
    publishReferencesFixture(dataDir, {
      ...CATALOG,
      feats: [],
      optionalFeatures: [],
      lookups: [...(CATALOG.lookups ?? []), { ...ALERT, kind: "variantrule", qualifier: "" }],
      tagRedirects: [
        {
          tag: "feats.html",
          from_key: "alert_phb",
          to_tag: "variantrules.html",
          to_key: "alert_phb",
        },
        {
          tag: "optionalfeatures.html",
          from_key: "archery_phb",
          to_tag: "optionalfeatures.html",
          to_key: "archery_xphb",
        },
      ],
    });
    store(definitionWith());
    expect(await unresolved()).toEqual([
      { field: "feats[0].ref", kind: "feat", ref: ALERT },
      { field: "optionalFeatures[0].ref", kind: "optionalFeature", ref: ARCHERY },
    ]);
  });

  it("checks a subclass, a subrace and a deity against their whole key", async () => {
    publishReferencesFixture(dataDir, {
      ...CATALOG,
      subclasses: [{ ...CHAMPION, class_name: "Fighter", class_source: "XPHB" }],
      subraces: [{ ...HIGH, race_name: "Elf", race_source: "XPHB" }],
      lookups: [
        { ...ATHLETICS, kind: "skill", qualifier: "" },
        { ...COMMON, kind: "language", qualifier: "" },
        { name: TYR.name, source: TYR.source, kind: "deity", qualifier: "Norse" },
      ],
    });
    store(definitionWith());
    expect(await unresolved()).toEqual([
      { field: "levels[2].subclass", kind: "subclass", ref: CHAMPION, parent: FIGHTER },
      { field: "subrace", kind: "subrace", ref: HIGH, parent: ELF },
      { field: "feats[0].grantedBy.ref", kind: "subclass", ref: CHAMPION, parent: FIGHTER },
      {
        field: "deity",
        kind: "deity",
        ref: { name: TYR.name, source: TYR.source },
        pantheon: TYR.pantheon,
      },
    ]);
  });

  it("reports every field a dropped row is held in", async () => {
    publishReferencesFixture(dataDir, { ...CATALOG, classes: [] });
    store(definitionWith());
    expect((await unresolved()).map((reference) => reference.field)).toEqual([
      "levels[0].class",
      "levels[1].class",
      "levels[2].class",
      "spells[0].origin",
      "feats[0].grantedBy.class",
      "optionalFeatures[0].grantedBy.ref",
    ]);
  });

  it("reports a variant its base item no longer takes, or that is no longer a variant", async () => {
    const DAGGER = { name: "Dagger", source: "PHB" };
    const CLUB = { name: "Club", source: "PHB" };
    publishReferencesFixture(dataDir, {
      ...CATALOG,
      items: [
        itemRow(LONGSWORD, "baseitem", { weapon: true }),
        itemRow(DAGGER, "item", { weapon: true }),
        itemRow(CLUB, "baseitem", { armor: true }),
        PLUS_ONE_ROW,
      ],
    });
    store(
      definitionWith({
        inventory: [
          { ref: LONGSWORD, variant: PLUS_ONE },
          { ref: DAGGER, variant: PLUS_ONE },
          { ref: CLUB, variant: PLUS_ONE },
        ],
      }),
    );
    expect(await unresolved()).toEqual([
      { field: "inventory[1].variant", kind: "item", ref: PLUS_ONE, parent: DAGGER },
      { field: "inventory[2].variant", kind: "item", ref: PLUS_ONE, parent: CLUB },
    ]);
  });

  it("reports a variant's redirect only where the row it names takes the same base", async () => {
    const XDMG_PLUS_ONE = { name: "+1 Weapon", source: "XDMG" };
    const CHAIN_MAIL = { name: "Chain Mail", source: "PHB" };
    publishReferencesFixture(dataDir, {
      ...CATALOG,
      items: [
        itemRow(CHAIN_MAIL, "baseitem", { armor: true }),
        itemRow(LONGSWORD, "baseitem", { weapon: true }),
        itemRow(XDMG_PLUS_ONE, "magicvariant", {
          requires: [{ weapon: true }],
          inherits: { namePrefix: "+1 ", source: "XDMG" },
        }),
      ],
      tagRedirects: [
        {
          tag: "items.html",
          from_key: "%2b1%20weapon_dmg",
          to_tag: "items.html",
          to_key: "%2b1%20weapon_xdmg",
        },
      ],
    });
    store(
      definitionWith({
        inventory: [
          { ref: LONGSWORD, variant: PLUS_ONE },
          { ref: CHAIN_MAIL, variant: PLUS_ONE },
        ],
      }),
    );
    expect(await unresolved()).toEqual([
      {
        field: "inventory[0].variant",
        kind: "item",
        ref: PLUS_ONE,
        parent: LONGSWORD,
        renamedTo: XDMG_PLUS_ONE,
      },
      { field: "inventory[1].variant", kind: "item", ref: PLUS_ONE, parent: CHAIN_MAIL },
    ]);
  });

  it("checks the conditions the state holds, following a redirect like any other", async () => {
    const PRONE = { name: "Prone", source: "PHB" };
    const BLINDED = { name: "Blinded", source: "PHB" };
    publishReferencesFixture(dataDir, {
      ...CATALOG,
      lookups: [
        ...(CATALOG.lookups ?? []),
        { name: "Prone", source: "XPHB", kind: "condition", qualifier: "" },
      ],
      tagRedirects: [
        {
          tag: "conditionsdiseases.html",
          from_key: "prone_phb",
          to_tag: "conditionsdiseases.html",
          to_key: "prone_xphb",
        },
      ],
    });
    store(definitionWith());
    updateCharacterState(opened.charactersDb, "1", {
      ...defaultCharacterState(),
      conditions: [PRONE, BLINDED],
    });
    expect(await unresolved()).toEqual([
      {
        field: "conditions[0]",
        kind: "condition",
        ref: PRONE,
        renamedTo: { name: "Prone", source: "XPHB" },
      },
      { field: "conditions[1]", kind: "condition", ref: BLINDED },
    ]);
  });

  it("leaves a homebrew reference, and a subclass under a homebrew class, unchecked", async () => {
    publishReferencesFixture(dataDir, CATALOG);
    store(
      definitionWith({
        levels: [{ class: { homebrewId: "hb-class" }, subclass: CHAMPION }],
        background: { homebrewId: "hb-background" },
        feats: [],
        optionalFeatures: [],
        spells: [{ ref: { homebrewId: "hb-spell" } }],
      }),
    );
    expect(await unresolved()).toEqual([]);
  });
});
