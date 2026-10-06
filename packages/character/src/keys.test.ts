import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DeityRef, deityKey, refKey } from "./index.ts";

const DEITIES = join(import.meta.dirname, "../../../tests/fixtures/5etools/data/deities.json");

const { deity: rows }: { deity: DeityRef[] } = JSON.parse(readFileSync(DEITIES, "utf8"));

describe("deityKey", () => {
  it("keeps apart the two gods upstream writes as Oghma (PHB)", () => {
    const oghmas = rows
      .filter((row) => row.name === "Oghma" && row.source === "PHB")
      .map(({ name, source, pantheon }) => ({ name, source, pantheon }));

    expect(oghmas.map((row) => row.pantheon).sort()).toEqual(["Celtic", "Forgotten Realms"]);
    expect(new Set(oghmas.map(deityKey)).size).toBe(2);
  });

  it("refuses a deity where a (name, source) key is asked for", () => {
    const tyr: DeityRef = { name: "Tyr", source: "PHB", pantheon: "Norse" };
    // @ts-expect-error A deity's pair names two gods, so refKey takes none.
    refKey(tyr);
    expect(refKey({ name: "Tyr", source: "PHB" })).toBe("Tyr|PHB");
  });
});
