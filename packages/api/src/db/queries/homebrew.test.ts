import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  HomebrewBackgroundInput,
  HomebrewFeatInput,
  HomebrewItemInput,
  HomebrewSpellInput,
} from "@dnd/catalog";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../client.ts";
import {
  deleteHomebrewBackground,
  deleteHomebrewFeat,
  deleteHomebrewItem,
  deleteHomebrewSpell,
  getHomebrewBackground,
  getHomebrewFeat,
  getHomebrewItem,
  getHomebrewSpell,
  insertHomebrewBackground,
  insertHomebrewFeat,
  insertHomebrewItem,
  insertHomebrewSpell,
  listHomebrewBackgrounds,
  listHomebrewFeats,
  listHomebrewItems,
  listHomebrewSpells,
  searchHomebrewItems,
  searchHomebrewSpells,
  updateHomebrewBackground,
  updateHomebrewFeat,
  updateHomebrewItem,
  updateHomebrewSpell,
} from "./homebrew.ts";

const sunblade = (overrides: Partial<HomebrewItemInput> = {}): HomebrewItemInput => ({
  name: "Sunblade",
  edition: "one",
  type: "M",
  rarity: "rare",
  ...overrides,
});

const wanderer = (overrides: Partial<HomebrewBackgroundInput> = {}): HomebrewBackgroundInput => ({
  name: "Wanderer",
  edition: "one",
  ...overrides,
});

const acidSplash = (overrides: Partial<HomebrewSpellInput> = {}): HomebrewSpellInput => ({
  name: "Acid Splash",
  edition: "one",
  level: 0,
  school: "C",
  duration: [{ type: "instant" }],
  ...overrides,
});

const ironbound = (overrides: Partial<HomebrewFeatInput> = {}): HomebrewFeatInput => ({
  name: "Ironbound",
  edition: "one",
  ...overrides,
});

describe("homebrew queries", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
  let db: ReturnType<typeof openDatabases>["homebrewDb"];

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "homebrew-queries-"));
    opened = openDatabases(dataDir);
    db = opened.homebrewDb;
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("items", () => {
    it("stamps HOMEBREW_SOURCE into json regardless of what a caller sends", () => {
      const row = insertHomebrewItem(db, "1", {
        ...sunblade(),
        source: "PHB",
      } as HomebrewItemInput);
      expect(row.json.source).toBe("HB");
    });

    it("derives type, rarity and requiresAttunement from the entry on insert", () => {
      const row = insertHomebrewItem(db, "1", sunblade({ reqAttune: true }));
      expect(row).toMatchObject({
        name: "Sunblade",
        edition: "one",
        type: "M",
        rarity: "rare",
        requiresAttunement: true,
      });
    });

    it('reads reqAttune: "optional" as attunable, not required', () => {
      const row = insertHomebrewItem(db, "1", sunblade({ reqAttune: "optional" }));
      expect(row.requiresAttunement).toBe(false);
    });

    it('requires attunement for a condition string, such as "by a spellcaster"', () => {
      const row = insertHomebrewItem(db, "1", sunblade({ reqAttune: "by a spellcaster" }));
      expect(row.requiresAttunement).toBe(true);
    });

    it("lists and reads items by id", () => {
      insertHomebrewItem(db, "1", sunblade());
      insertHomebrewItem(db, "2", sunblade({ name: "Moonblade" }));

      expect(
        listHomebrewItems(db)
          .map((row) => row.name)
          .sort(),
      ).toEqual(["Moonblade", "Sunblade"]);
      expect(getHomebrewItem(db, "1")).toMatchObject({ id: "1", name: "Sunblade" });
      expect(getHomebrewItem(db, "missing")).toBeUndefined();
    });

    it("renames an item without changing its id", () => {
      insertHomebrewItem(db, "1", sunblade());

      const renamed = updateHomebrewItem(db, "1", sunblade({ name: "Sunblade+1" }));
      expect(renamed).toMatchObject({ id: "1", name: "Sunblade+1" });
    });

    it("stamps HOMEBREW_SOURCE on a rename regardless of what a caller sends", () => {
      insertHomebrewItem(db, "1", sunblade());

      const renamed = updateHomebrewItem(db, "1", {
        ...sunblade({ name: "Sunblade+1" }),
        source: "PHB",
      } as HomebrewItemInput);
      expect(renamed?.json.source).toBe("HB");
    });

    it("reports nothing updating or deleting an id that does not exist", () => {
      expect(updateHomebrewItem(db, "missing", sunblade())).toBeUndefined();
      expect(deleteHomebrewItem(db, "missing")).toBe(false);
    });

    it("deletes an item, after which it reads nothing", () => {
      insertHomebrewItem(db, "1", sunblade());

      expect(deleteHomebrewItem(db, "1")).toBe(true);
      expect(getHomebrewItem(db, "1")).toBeUndefined();
    });
  });

  describe("spells", () => {
    it("stamps HOMEBREW_SOURCE into json regardless of what a caller sends", () => {
      const row = insertHomebrewSpell(db, "1", {
        ...acidSplash(),
        source: "PHB",
      } as HomebrewSpellInput);
      expect(row.json.source).toBe("HB");
    });

    it("derives level, school, concentration and ritual from the entry on insert", () => {
      const row = insertHomebrewSpell(db, "1", acidSplash({ meta: { ritual: true } }));
      expect(row).toMatchObject({
        name: "Acid Splash",
        edition: "one",
        level: 0,
        school: "C",
        concentration: false,
        ritual: true,
      });
    });

    it("reads concentration off the duration span", () => {
      const row = insertHomebrewSpell(
        db,
        "1",
        acidSplash({ duration: [{ type: "timed", concentration: true }] }),
      );
      expect(row.concentration).toBe(true);
    });

    it("lists and reads spells by id", () => {
      insertHomebrewSpell(db, "1", acidSplash());
      insertHomebrewSpell(db, "2", acidSplash({ name: "Fire Bolt" }));

      expect(
        listHomebrewSpells(db)
          .map((row) => row.name)
          .sort(),
      ).toEqual(["Acid Splash", "Fire Bolt"]);
      expect(getHomebrewSpell(db, "1")).toMatchObject({ id: "1", name: "Acid Splash" });
      expect(getHomebrewSpell(db, "missing")).toBeUndefined();
    });

    it("renames a spell without changing its id", () => {
      insertHomebrewSpell(db, "1", acidSplash());

      const renamed = updateHomebrewSpell(db, "1", acidSplash({ name: "Acid Splash II" }));
      expect(renamed).toMatchObject({ id: "1", name: "Acid Splash II" });
    });

    it("stamps HOMEBREW_SOURCE on a rename regardless of what a caller sends", () => {
      insertHomebrewSpell(db, "1", acidSplash());

      const renamed = updateHomebrewSpell(db, "1", {
        ...acidSplash({ name: "Acid Splash II" }),
        source: "PHB",
      } as HomebrewSpellInput);
      expect(renamed?.json.source).toBe("HB");
    });

    it("reports nothing updating or deleting an id that does not exist", () => {
      expect(updateHomebrewSpell(db, "missing", acidSplash())).toBeUndefined();
      expect(deleteHomebrewSpell(db, "missing")).toBe(false);
    });

    it("deletes a spell, after which it reads nothing", () => {
      insertHomebrewSpell(db, "1", acidSplash());

      expect(deleteHomebrewSpell(db, "1")).toBe(true);
      expect(getHomebrewSpell(db, "1")).toBeUndefined();
    });
  });

  describe("backgrounds", () => {
    it("stamps HOMEBREW_SOURCE into json regardless of what a caller sends", () => {
      const row = insertHomebrewBackground(db, "1", {
        ...wanderer(),
        source: "PHB",
      } as HomebrewBackgroundInput);
      expect(row.json.source).toBe("HB");
    });

    it("derives name from the entry on insert", () => {
      const row = insertHomebrewBackground(db, "1", wanderer());
      expect(row).toMatchObject({ name: "Wanderer", edition: "one" });
    });

    it("lists and reads backgrounds by id", () => {
      insertHomebrewBackground(db, "1", wanderer());
      insertHomebrewBackground(db, "2", wanderer({ name: "Drifter" }));

      expect(
        listHomebrewBackgrounds(db)
          .map((row) => row.name)
          .sort(),
      ).toEqual(["Drifter", "Wanderer"]);
      expect(getHomebrewBackground(db, "1")).toMatchObject({ id: "1", name: "Wanderer" });
      expect(getHomebrewBackground(db, "missing")).toBeUndefined();
    });

    it("renames a background without changing its id", () => {
      insertHomebrewBackground(db, "1", wanderer());

      const renamed = updateHomebrewBackground(db, "1", wanderer({ name: "Wanderer II" }));
      expect(renamed).toMatchObject({ id: "1", name: "Wanderer II" });
    });

    it("stamps HOMEBREW_SOURCE on a rename regardless of what a caller sends", () => {
      insertHomebrewBackground(db, "1", wanderer());

      const renamed = updateHomebrewBackground(db, "1", {
        ...wanderer({ name: "Wanderer II" }),
        source: "PHB",
      } as HomebrewBackgroundInput);
      expect(renamed?.json.source).toBe("HB");
    });

    it("reports nothing updating or deleting an id that does not exist", () => {
      expect(updateHomebrewBackground(db, "missing", wanderer())).toBeUndefined();
      expect(deleteHomebrewBackground(db, "missing")).toBe(false);
    });

    it("deletes a background, after which it reads nothing", () => {
      insertHomebrewBackground(db, "1", wanderer());

      expect(deleteHomebrewBackground(db, "1")).toBe(true);
      expect(getHomebrewBackground(db, "1")).toBeUndefined();
    });
  });

  describe("feats", () => {
    it("stamps HOMEBREW_SOURCE into json regardless of what a caller sends", () => {
      const row = insertHomebrewFeat(db, "1", {
        ...ironbound(),
        source: "PHB",
      } as HomebrewFeatInput);
      expect(row.json.source).toBe("HB");
    });

    it("derives name from the entry on insert", () => {
      const row = insertHomebrewFeat(db, "1", ironbound());
      expect(row).toMatchObject({ name: "Ironbound", edition: "one" });
    });

    it("lists and reads feats by id", () => {
      insertHomebrewFeat(db, "1", ironbound());
      insertHomebrewFeat(db, "2", ironbound({ name: "Stoneheart" }));

      expect(
        listHomebrewFeats(db)
          .map((row) => row.name)
          .sort(),
      ).toEqual(["Ironbound", "Stoneheart"]);
      expect(getHomebrewFeat(db, "1")).toMatchObject({ id: "1", name: "Ironbound" });
      expect(getHomebrewFeat(db, "missing")).toBeUndefined();
    });

    it("renames a feat without changing its id", () => {
      insertHomebrewFeat(db, "1", ironbound());

      const renamed = updateHomebrewFeat(db, "1", ironbound({ name: "Ironbound II" }));
      expect(renamed).toMatchObject({ id: "1", name: "Ironbound II" });
    });

    it("stamps HOMEBREW_SOURCE on a rename regardless of what a caller sends", () => {
      insertHomebrewFeat(db, "1", ironbound());

      const renamed = updateHomebrewFeat(db, "1", {
        ...ironbound({ name: "Ironbound II" }),
        source: "PHB",
      } as HomebrewFeatInput);
      expect(renamed?.json.source).toBe("HB");
    });

    it("reports nothing updating or deleting an id that does not exist", () => {
      expect(updateHomebrewFeat(db, "missing", ironbound())).toBeUndefined();
      expect(deleteHomebrewFeat(db, "missing")).toBe(false);
    });

    it("deletes a feat, after which it reads nothing", () => {
      insertHomebrewFeat(db, "1", ironbound());

      expect(deleteHomebrewFeat(db, "1")).toBe(true);
      expect(getHomebrewFeat(db, "1")).toBeUndefined();
    });
  });

  describe("search", () => {
    it("finds an item by a case-insensitive substring of its name, filtered to one edition", () => {
      insertHomebrewItem(db, "1", sunblade());
      insertHomebrewItem(db, "2", sunblade({ name: "Moonblade", edition: "classic" }));

      expect(searchHomebrewItems(db, "one", "sun").map((row) => row.id)).toEqual(["1"]);
      expect(searchHomebrewItems(db, "one", "blade").map((row) => row.id)).toEqual(["1"]);
      expect(searchHomebrewItems(db, "one", "nonexistent")).toEqual([]);
    });

    it("finds a spell by a case-insensitive substring of its name, filtered to one edition", () => {
      insertHomebrewSpell(db, "1", acidSplash());
      insertHomebrewSpell(db, "2", acidSplash({ name: "Fire Bolt", edition: "classic" }));

      expect(searchHomebrewSpells(db, "one", "acid").map((row) => row.id)).toEqual(["1"]);
      expect(searchHomebrewSpells(db, "classic", "acid")).toEqual([]);
    });

    it("escapes a literal percent in the term so it does not act as a wildcard", () => {
      insertHomebrewItem(db, "1", sunblade({ name: "100% Cotton Cloak" }));
      insertHomebrewItem(db, "2", sunblade({ name: "Moonblade" }));

      expect(searchHomebrewItems(db, "one", "100%").map((row) => row.id)).toEqual(["1"]);
    });
  });
});
