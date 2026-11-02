import { catalogRowEntries } from "@dnd/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { matchCatalogTarget } from "./catalogRows.ts";

describe("matchCatalogTarget", () => {
  it("decodes each segment of the key, an encoded slash included", () => {
    const match = matchCatalogTarget("/spells/Mage%20Hand%20%2F%20Legerdemain/XPHB");
    expect(match?.target.label(match.key)).toBe("spell");
    expect(match?.key).toEqual({ name: "Mage Hand / Legerdemain", source: "XPHB" });
  });

  it("names a class feature by its class, its key and its level", () => {
    const match = matchCatalogTarget("/classes/Fighter/PHB/features/Action%20Surge/PHB/2");
    expect(match?.target.label(match.key)).toBe("class feature");
    expect(match?.key).toMatchObject({ className: "Fighter", name: "Action Surge", level: "2" });
  });

  it("labels a catalog row by its type and reads a qualifier as the last segment", () => {
    const match = matchCatalogTarget("/catalog/variantrule/Hiding/XPHB");
    expect(match?.target.label(match.key)).toBe("variant rule");
    expect(matchCatalogTarget("/catalog/card/Balance/BMT/Deck%20of%20Many%20Things")?.key).toEqual({
      type: "card",
      name: "Balance",
      source: "BMT",
      qualifier: "Deck of Many Things",
    });
  });

  it.each(["/monsters/Goblin/MM", "/spells/%E0%A4%A/PHB"])("matches nothing at %s", (address) => {
    expect(matchCatalogTarget(address)).toBeUndefined();
  });
});

describe("a homebrew monster's target", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the stat block a catalog monster gets, reading the record's edition", async () => {
    const json = {
      name: "Ember Imp",
      source: "HB",
      size: ["T"],
      type: "fiend",
      ac: [13],
      hp: { average: 10, formula: "3d4 + 3" },
      speed: { walk: 20 },
      str: 6,
      dex: 17,
      con: 13,
      int: 11,
      wis: 12,
      cha: 14,
      cr: "1/2",
    };
    const record = {
      id: "m1",
      name: "Ember Imp",
      edition: "one",
      json,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    stubFetchByUrl({ "/api/homebrew/monsters/m1": record });

    const match = matchCatalogTarget("/homebrew/monsters/m1");
    const row = await match?.target.load(match.key);
    expect(row?.name).toBe("Ember Imp");
    expect(row?.entries).toEqual(catalogRowEntries("monster", json, "one"));
    expect(JSON.stringify(row?.entries)).toContain("Tiny fiend");
    expect(JSON.stringify(row?.entries)).toContain("+3 (13)");
  });
});

describe("a homebrew class's target", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the detail response, which carries the class's resource tables", async () => {
    const record = {
      id: "c1",
      name: "Warden",
      edition: "one",
      hitDie: 10,
      json: { name: "Warden", source: "HB", hd: { number: 1, faces: 10 } },
      createdAt: "2026-01-01T00:00:00.000Z",
      resources: [{ name: "Wards", maximums: Array.from({ length: 20 }, () => 2) }],
    };
    stubFetchByUrl({ "/api/homebrew/classes/c1": record, "/api/homebrew/classes/c1/features": [] });

    const match = matchCatalogTarget("/homebrew/classes/c1");
    const row = await match?.target.load(match.key);
    expect(row?.name).toBe("Warden");
  });
});
