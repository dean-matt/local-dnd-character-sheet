import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_REFS_PER_REQUEST, type RefQuery } from "@dnd/catalog";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishRefsFixture } from "../db/queries/contentFixture.ts";
import {
  deleteHomebrewItem,
  insertHomebrewBackground,
  insertHomebrewClass,
  insertHomebrewFeat,
  insertHomebrewItem,
  insertHomebrewRace,
  insertHomebrewSpell,
  updateHomebrewItem,
} from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { refsRoutes } from "./refs.ts";

const row = (name: string, source: string, entries: unknown[] = []) => ({
  name,
  source,
  json: JSON.stringify({ name, source, entries }),
});

const deity = (name: string, source: string, pantheon: string) => ({
  kind: "deity",
  qualifier: pantheon,
  name,
  source,
  json: JSON.stringify({ name, source, pantheon }),
});

const fighter = { class_name: "Fighter", class_source: "PHB" };

const berserker = (source: string) => ({
  class_name: "Barbarian",
  class_source: source,
  subclass_short_name: "Berserker",
  subclass_source: source,
});

describe("refsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof refsRoutes>;

  const resolve = (refs: unknown[]) =>
    routes.request("/refs/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refs }),
    });

  const resolveOk = async (refs: RefQuery[]) => {
    const res = await resolve(refs);
    expect(res.status).toBe(200);
    return (await res.json()).refs;
  };

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "refs-routes-"));
    publishRefsFixture(dataDir, {
      spells: [row("Fireball", "PHB", ["A bright streak."]), row("Fireball", "XPHB")],
      races: [row("Human", "PHB"), row("Elf (Zendikar)", "PSZ"), row("Gnome (Deep)", "MTF")],
      subraces: [
        { ...row("", "PHB"), full_name: "Human (Base)", race_name: "Human", race_source: "PHB" },
        {
          ...row("Deep", "MTF"),
          full_name: "Gnome (Deep)",
          race_name: "Gnome",
          race_source: "PHB",
        },
        {
          ...row("Tajuru Nation", "PSZ"),
          full_name: "Elf (Tajuru Nation)",
          race_name: "Elf",
          race_source: "PHB",
        },
        {
          ...row("Tajuru Nation", "PSZ"),
          full_name: "Elf (Tajuru Nation)",
          race_name: "Elf",
          race_source: "PSZ",
        },
        {
          ...row("Keldon", "PSD", ["Tall."]),
          full_name: "Human (Keldon)",
          race_name: "Human",
          race_source: "PHB",
        },
        {
          ...row("Joraga Nation", "PSZ"),
          full_name: "Elf (Zendikar; Joraga Nation)",
          race_name: "Elf (Zendikar)",
          race_source: "PSZ",
        },
        {
          ...row("Variant; Mark of Finding", "ERLW"),
          full_name: "Human (Variant; Mark of Finding)",
          race_name: "Human",
          race_source: "PHB",
        },
        {
          ...row("Variant; Mark of Finding", "ERLW"),
          full_name: "Half-Orc (Variant; Mark of Finding)",
          race_name: "Half-Orc",
          race_source: "PHB",
        },
      ],
      subclasses: [
        {
          ...row("Battle Master", "PHB"),
          short_name: "Battle Master",
          class_name: "Fighter",
          class_source: "XPHB",
        },
        {
          ...row("Battle Master", "PHB"),
          short_name: "Battle Master",
          class_name: "Fighter",
          class_source: "PHB",
        },
      ],
      classFeatures: [
        { ...row("Ability Score Improvement", "PHB", ["Fighter 4."]), ...fighter, level: 4 },
        { ...row("Ability Score Improvement", "PHB", ["Fighter 6."]), ...fighter, level: 6 },
        {
          ...row("Ability Score Improvement", "PHB", ["Barbarian 4."]),
          class_name: "Barbarian",
          class_source: "PHB",
          level: 4,
        },
        {
          ...row("Ability Score Improvement", "XPHB", ["Fighter 2024."]),
          class_name: "Fighter",
          class_source: "XPHB",
          level: 4,
        },
      ],
      subclassFeatures: [
        { ...row("Frenzy", "PHB", ["2014."]), ...berserker("PHB"), level: 3 },
        { ...row("Frenzy", "XPHB", ["2024."]), ...berserker("XPHB"), level: 3 },
      ],
      lookups: [
        { kind: "variantrule", qualifier: "", ...row("Unarmed Strike", "XPHB", ["Punch."]) },
        { kind: "condition", qualifier: "", ...row("Blinded", "XPHB") },
        { kind: "deity", qualifier: "Greek", ...row("Zeus", "PHB") },
        deity("Tyr", "PHB", "Forgotten Realms"),
        deity("Tyr", "PHB", "Norse"),
        deity("Umberlee", "SCAG", "Faerûnian"),
        {
          kind: "language",
          qualifier: "",
          name: "Common",
          source: "PHB",
          json: JSON.stringify({ name: "Common", source: "PHB", type: "standard" }),
        },
        { kind: "language", qualifier: "", ...row("Olman", "TftYP") },
      ],
      optionalFeatures: [row("Agonizing Blast", "PHB", ["Add your Charisma modifier."])],
      entities: [
        {
          type: "monster",
          qualifier: "",
          name: "Goblin",
          source: "MM",
          json: JSON.stringify({ name: "Goblin", source: "MM", size: ["S"], cr: "1/4" }),
        },
        { type: "legendaryGroup", qualifier: "", ...row("Aboleth", "MM") },
        { type: "card", qualifier: "Deck of Many Things", ...row("Vizier", "DMG", ["Know."]) },
        { type: "card", qualifier: "Tarokka Deck", ...row("Ghost", "CoS", ["Haunt."]) },
        { type: "card", qualifier: "Tarokka Deck", ...row("Mists", "CoS") },
        {
          type: "legendaryGroup",
          qualifier: "",
          name: "Lich",
          source: "MM",
          json: JSON.stringify({ name: "Lich", source: "MM", lairActions: ["Lair."] }),
        },
      ],
      tagRedirects: [
        {
          tag: "actions.html",
          from_key: "shove_phb",
          to_tag: "variantrules.html",
          to_key: "unarmed%20strike_xphb",
        },
        {
          tag: "conditionsdiseases.html",
          from_key: "blinded_phb",
          to_tag: "conditionsdiseases.html",
          to_key: "blinded_xphb",
        },
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = refsRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("resolves by name and source whatever their case, with the row's own spelling and route", async () => {
    expect(await resolveOk([{ tag: "spell", name: "fireball", source: "phb" }])).toEqual([
      {
        name: "Fireball",
        source: "PHB",
        entries: ["A bright streak."],
        path: "/spells/Fireball/PHB",
      },
    ]);
  });

  it("carries a spell's upcast rule after its entries", async () => {
    const upcastDir = mkdtempSync(join(dataDir, "upcast-"));
    routes = refsRoutes(upcastDir, opened.homebrewDb);
    publishRefsFixture(upcastDir, {
      spells: [
        {
          name: "Fireball",
          source: "PHB",
          json: JSON.stringify({ entries: ["Boom."], entriesHigherLevel: ["Bigger boom."] }),
        },
      ],
    });
    const [spell] = await resolveOk([{ tag: "spell", name: "Fireball" }]);
    expect(spell.entries).toEqual(["Boom.", "Bigger boom."]);
  });

  it("falls back to the tag's default source where the reference names none", async () => {
    const [spell, creature] = await resolveOk([
      { tag: "spell", name: "Fireball" },
      { tag: "creature", name: "goblin" },
    ]);
    expect(spell).toMatchObject({ name: "Fireball", source: "PHB" });
    expect(creature).toMatchObject({ name: "Goblin", source: "MM", entries: [] });
  });

  it("refuses an empty source rather than matching it", async () => {
    const res = await resolve([{ tag: "spell", name: "Fireball", source: "" }]);
    expect(res.status).toBe(400);
  });

  it("follows a redirect within its page and into another", async () => {
    expect(
      await resolveOk([
        { tag: "condition", name: "blinded" },
        { tag: "action", name: "Shove", source: "PHB" },
      ]),
    ).toEqual([
      { name: "Blinded", source: "XPHB", entries: [] },
      {
        name: "Unarmed Strike",
        source: "XPHB",
        entries: ["Punch."],
        path: "/catalog/variantrule/Unarmed%20Strike/XPHB",
      },
    ]);
  });

  it("links an optional feature with prose to its catalog row, and leaves one without unlinked", async () => {
    const [invocation, condition] = await resolveOk([
      { tag: "optfeature", name: "agonizing blast" },
      { tag: "condition", name: "Blinded" },
    ]);
    expect(invocation.path).toBe("/catalog/optfeature/Agonizing%20Blast/PHB");
    expect(condition).not.toHaveProperty("path");
  });

  it("links a language to its fields, though it has no prose, and leaves one with neither unlinked", async () => {
    const [common, olman] = await resolveOk([
      { tag: "language", name: "common" },
      { tag: "language", name: "Olman", source: "TftYP" },
    ]);
    expect(common).toEqual({
      name: "Common",
      source: "PHB",
      entries: [],
      path: "/catalog/language/Common/PHB",
    });
    expect(olman).not.toHaveProperty("path");
  });

  it("links a creature to its stat block, though it has no prose to show in a popover", async () => {
    const [creature] = await resolveOk([{ tag: "creature", name: "Goblin" }]);
    expect(creature).toEqual({
      name: "Goblin",
      source: "MM",
      entries: [],
      path: "/catalog/monster/Goblin/MM",
    });
  });

  it("links a legendary group to its lair only where it has one to show", async () => {
    const [lich, aboleth] = await resolveOk([
      { tag: "legroup", name: "Lich" },
      { tag: "legroup", name: "Aboleth" },
    ]);
    expect(lich.path).toBe("/catalog/legendaryGroup/Lich/MM");
    expect(aboleth).not.toHaveProperty("path");
  });

  it("answers null, in place, for what the catalog does not have", async () => {
    expect(
      await resolveOk([
        { tag: "spell", name: "Wish" },
        { tag: "notarealtag", name: "Fireball" },
        { tag: "deity", name: "Zeus", source: "PHB" },
        { tag: "variantrule", name: "Unarmed Strike", source: "XPHB" },
      ]),
    ).toEqual([null, null, null, expect.objectContaining({ name: "Unarmed Strike" })]);
  });

  describe("deity", () => {
    it("tells apart deities of one name and source by pantheon, ignoring case", async () => {
      const [realms, norse] = await resolveOk([
        { tag: "deity", name: "tyr", source: "phb", qualifier: "forgotten realms" },
        { tag: "deity", name: "Tyr", source: "PHB", qualifier: "norse" },
      ]);
      expect(realms).toEqual({
        name: "Tyr",
        source: "PHB",
        entries: [],
        path: "/catalog/deity/Tyr/PHB/Forgotten%20Realms",
      });
      expect(norse.path).toBe("/catalog/deity/Tyr/PHB/Norse");
    });

    it("defaults the pantheon to the Forgotten Realms and the source to PHB", async () => {
      const [bare, pantheonOnly] = await resolveOk([
        { tag: "deity", name: "Tyr" },
        { tag: "deity", name: "Tyr", qualifier: "Norse" },
      ]);
      expect(bare.path).toBe("/catalog/deity/Tyr/PHB/Forgotten%20Realms");
      expect(pantheonOnly.path).toBe("/catalog/deity/Tyr/PHB/Norse");
    });

    it("answers null for a deity outside the pantheon named", async () => {
      expect(
        await resolveOk([
          { tag: "deity", name: "Umberlee", source: "SCAG", qualifier: "Norse" },
          { tag: "deity", name: "Umberlee", source: "SCAG" },
        ]),
      ).toEqual([null, null]);
    });
  });

  describe("card", () => {
    it("resolves a card by its deck, with the deck's default source", async () => {
      const [vizier, ghost] = await resolveOk([
        { tag: "card", name: "vizier", qualifier: "deck of many things" },
        { tag: "card", name: "Ghost", source: "CoS", qualifier: "Tarokka Deck" },
      ]);
      expect(vizier).toEqual({
        name: "Vizier",
        source: "DMG",
        entries: ["Know."],
        path: "/catalog/card/Vizier/DMG/Deck%20of%20Many%20Things",
      });
      expect(ghost.path).toBe("/catalog/card/Ghost/CoS/Tarokka%20Deck");
    });

    it("leaves a card without prose unlinked, and answers null for one naming no deck or another deck", async () => {
      const [mists, deckless, elsewhere] = await resolveOk([
        { tag: "card", name: "Mists", source: "CoS", qualifier: "Tarokka Deck" },
        { tag: "card", name: "Ghost", source: "CoS" },
        { tag: "card", name: "Ghost", source: "CoS", qualifier: "Deck of Many Things" },
      ]);
      expect(mists).not.toHaveProperty("path");
      expect([deckless, elsewhere]).toEqual([null, null]);
    });
  });

  it("links a subclass under the class printed in its own source", async () => {
    const [subclass] = await resolveOk([{ tag: "subclass", name: "battle master", source: "PHB" }]);
    expect(subclass.path).toBe("/classes/Fighter/PHB/subclasses/Battle%20Master/PHB");
  });

  describe("feature", () => {
    const asi = (owner: RefQuery["owner"], source?: string): RefQuery => ({
      tag: "classFeature",
      name: "ability score improvement",
      ...(source === undefined ? {} : { source }),
      owner,
    });

    it("tells apart a class feature named the same at two levels and in two classes", async () => {
      const rows = await resolveOk([
        asi({ className: "Fighter", level: 6 }),
        asi({ className: "barbarian", classSource: "PHB", level: 4 }),
        asi({ className: "Fighter", classSource: "XPHB", level: 4 }, "XPHB"),
      ]);
      expect(rows.map((found: { entries: string[] }) => found.entries)).toEqual([
        ["Fighter 6."],
        ["Barbarian 4."],
        ["Fighter 2024."],
      ]);
      expect(rows[0].path).toBe(
        "/classes/Fighter/PHB/features/Ability%20Score%20Improvement/PHB/6",
      );
    });

    it("resolves a subclass feature by its subclass's short name and source", async () => {
      const [classic, current] = await resolveOk([
        {
          tag: "subclassFeature",
          name: "Frenzy",
          owner: { className: "Barbarian", subclassShortName: "berserker", level: 3 },
        },
        {
          tag: "subclassFeature",
          name: "Frenzy",
          source: "XPHB",
          owner: {
            className: "Barbarian",
            classSource: "XPHB",
            subclassShortName: "Berserker",
            subclassSource: "XPHB",
            level: 3,
          },
        },
      ]);
      expect(classic).toMatchObject({
        entries: ["2014."],
        path: "/classes/Barbarian/PHB/subclasses/Berserker/PHB/features/Frenzy/PHB/3",
      });
      expect(current.entries).toEqual(["2024."]);
    });

    it("answers null for a feature missing part of its key, or at a level it does not arrive at", async () => {
      expect(
        await resolveOk([
          { tag: "classFeature", name: "Ability Score Improvement" },
          asi({ className: "Fighter", level: 5 }),
          {
            tag: "subclassFeature",
            name: "Frenzy",
            owner: { className: "Barbarian", level: 3 },
          },
        ]),
      ).toEqual([null, null, null]);
    });

    it("refuses an owner at a level no class reaches", async () => {
      const res = await resolve([asi({ className: "Fighter", level: 21 })]);
      expect(res.status).toBe(400);
    });
  });

  describe("race", () => {
    it("resolves a plain race name to the race row", async () => {
      expect(await resolveOk([{ tag: "race", name: "human" }])).toEqual([
        { name: "Human", source: "PHB", entries: [], path: "/races/Human/PHB" },
      ]);
    });

    it("resolves the Race (Subrace) form to the subrace row, under its race", async () => {
      expect(await resolveOk([{ tag: "race", name: "Human (Keldon)", source: "PSD" }])).toEqual([
        {
          name: "Human (Keldon)",
          source: "PSD",
          entries: ["Tall."],
          path: "/races/Human/PHB/subraces/Keldon/PSD",
        },
      ]);
    });

    it("resolves a subrace under a race whose name already ends in parens", async () => {
      const [subrace] = await resolveOk([
        { tag: "race", name: "Elf (Zendikar; Joraga Nation)", source: "PSZ" },
      ]);
      expect(subrace.path).toBe("/races/Elf%20(Zendikar)/PSZ/subraces/Joraga%20Nation/PSZ");
    });

    it("tells apart subraces that share a name and source by their race", async () => {
      const paths = (
        await resolveOk([
          { tag: "race", name: "Human (Variant; Mark of Finding)", source: "ERLW" },
          { tag: "race", name: "half-orc (variant; mark of finding)", source: "erlw" },
        ])
      ).map((resolved: { path: string }) => resolved.path);
      expect(paths).toEqual([
        "/races/Human/PHB/subraces/Variant%3B%20Mark%20of%20Finding/ERLW",
        "/races/Half-Orc/PHB/subraces/Variant%3B%20Mark%20of%20Finding/ERLW",
      ]);
    });

    it("links under the race printed in the subrace's own source, where two printings hold it", async () => {
      const [subrace] = await resolveOk([
        { tag: "race", name: "Elf (Tajuru Nation)", source: "PSZ" },
      ]);
      expect(subrace.path).toBe("/races/Elf/PSZ/subraces/Tajuru%20Nation/PSZ");
    });

    it("answers the race row over a subrace of the same merged name", async () => {
      const [race] = await resolveOk([{ tag: "race", name: "Gnome (Deep)", source: "MTF" }]);
      expect(race.path).toBe("/races/Gnome%20(Deep)/MTF");
    });

    it("answers null for a name that is neither a race nor a named subrace", async () => {
      expect(
        await resolveOk([
          { tag: "race", name: "Human (Nowhere)", source: "PSD" },
          { tag: "race", name: "Keldon", source: "PSD" },
          { tag: "race", name: "Human (Base)", source: "PHB" },
        ]),
      ).toEqual([null, null, null]);
    });
  });

  describe("homebrew", () => {
    const sword = { name: "My Sword", edition: "one" as const, entries: ["Sharp."] };

    it("resolves source HB to a homebrew item or spell by name, linking its homebrew page", async () => {
      insertHomebrewItem(opened.homebrewDb, "i", sword);
      insertHomebrewSpell(opened.homebrewDb, "s", {
        name: "My Spell",
        edition: "one",
        level: 1,
        school: "V",
        duration: [{ type: "instant" }],
        entries: ["Zap."],
        entriesHigherLevel: ["Bigger zap."],
      });

      expect(
        await resolveOk([
          { tag: "item", name: "my sword", source: "hb" },
          { tag: "spell", name: "My Spell", source: "HB" },
        ]),
      ).toEqual([
        { name: "My Sword", source: "HB", entries: ["Sharp."], path: "/homebrew/items/i" },
        {
          name: "My Spell",
          source: "HB",
          entries: ["Zap.", "Bigger zap."],
          path: "/homebrew/spells/s",
        },
      ]);
    });

    it("resolves source HB to a homebrew race, background, feat or class by name", async () => {
      const db = opened.homebrewDb;
      insertHomebrewRace(db, "r", { name: "Duskling", edition: "one", size: ["M"], speed: 30 });
      insertHomebrewBackground(db, "b", { name: "Wanderer", edition: "one", entries: ["Far."] });
      insertHomebrewFeat(db, "f", { name: "Ironbound", edition: "one" });
      insertHomebrewClass(db, "c", {
        name: "Warden",
        edition: "one",
        hd: { number: 1, faces: 10 },
      });

      expect(
        await resolveOk([
          { tag: "race", name: "duskling", source: "HB" },
          { tag: "background", name: "Wanderer", source: "hb" },
          { tag: "feat", name: "IRONBOUND", source: "HB" },
          { tag: "class", name: "Warden", source: "HB" },
        ]),
      ).toEqual([
        expect.objectContaining({ name: "Duskling", source: "HB", path: "/homebrew/races/r" }),
        { name: "Wanderer", source: "HB", entries: ["Far."], path: "/homebrew/backgrounds/b" },
        expect.objectContaining({ name: "Ironbound", source: "HB", path: "/homebrew/feats/f" }),
        expect.objectContaining({ name: "Warden", source: "HB", path: "/homebrew/classes/c" }),
      ]);
    });

    it("answers the classic row where both editions hold the name", async () => {
      insertHomebrewItem(opened.homebrewDb, "one", sword);
      insertHomebrewItem(opened.homebrewDb, "classic", { ...sword, edition: "classic" });

      const [row] = await resolveOk([{ tag: "item", name: "My Sword", source: "HB" }]);
      expect(row.path).toBe("/homebrew/items/classic");
    });

    it("answers null for a renamed or deleted row, and for a tag homebrew does not hold", async () => {
      insertHomebrewItem(opened.homebrewDb, "renamed", sword);
      updateHomebrewItem(opened.homebrewDb, "renamed", { ...sword, name: "Their Sword" });
      insertHomebrewItem(opened.homebrewDb, "deleted", { ...sword, name: "Old Sword" });
      deleteHomebrewItem(opened.homebrewDb, "deleted");

      expect(
        await resolveOk([
          { tag: "item", name: "My Sword", source: "HB" },
          { tag: "item", name: "Old Sword", source: "HB" },
          { tag: "creature", name: "Their Sword", source: "HB" },
        ]),
      ).toEqual([null, null, null]);
    });
  });

  it("answers an empty batch without opening the catalog", async () => {
    routes = refsRoutes(mkdtempSync(join(dataDir, "empty-")), opened.homebrewDb);
    expect(await resolveOk([])).toEqual([]);
  });

  it("refuses a batch past the bound", async () => {
    const refs = Array.from({ length: MAX_REFS_PER_REQUEST + 1 }, () => ({
      tag: "spell",
      name: "Fireball",
    }));
    expect((await resolve(refs)).status).toBe(400);
  });
});
