import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_REFS_PER_REQUEST, type RefQuery } from "@dnd/catalog";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabases } from "../db/client.ts";
import { publishRefsFixture } from "../db/queries/contentFixture.ts";
import {
  deleteHomebrewItem,
  insertHomebrewItem,
  insertHomebrewSpell,
  updateHomebrewItem,
} from "../db/queries/homebrew.ts";
import { refsRoutes } from "./refs.ts";

const row = (name: string, source: string, entries: unknown[] = []) => ({
  name,
  source,
  json: JSON.stringify({ name, source, entries }),
});

describe("refsRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openDatabases>;
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

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "refs-routes-"));
    publishRefsFixture(dataDir, {
      spells: [row("Fireball", "PHB", ["A bright streak."]), row("Fireball", "XPHB")],
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
      lookups: [
        { kind: "variantrule", qualifier: "", ...row("Unarmed Strike", "XPHB", ["Punch."]) },
        { kind: "condition", qualifier: "", ...row("Blinded", "XPHB") },
        { kind: "deity", qualifier: "Greek", ...row("Zeus", "PHB") },
      ],
      entities: [{ type: "monster", qualifier: "", ...row("Goblin", "MM") }],
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
    opened = openDatabases(dataDir);
    routes = refsRoutes(dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
    rmSync(dataDir, { recursive: true, force: true });
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
    publishRefsFixture(dataDir, {
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
    expect(creature).toEqual({ name: "Goblin", source: "MM", entries: [] });
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
      { name: "Unarmed Strike", source: "XPHB", entries: ["Punch."] },
    ]);
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

  it("links a subclass under the class printed in its own source", async () => {
    const [subclass] = await resolveOk([{ tag: "subclass", name: "battle master", source: "PHB" }]);
    expect(subclass.path).toBe("/classes/Fighter/PHB/subclasses/Battle%20Master/PHB");
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
    rmSync(dataDir, { recursive: true, force: true });
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
