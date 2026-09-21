import { parseTags, type Token } from "@dnd/tags";
import { describe, expect, it } from "vitest";
import {
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
  type SpellEntry,
  spellEntrySchema,
  spellRecordSchema,
} from "./index.ts";

const acidSplash = {
  name: "Acid Splash",
  source: "Homebrew",
  level: 0,
  school: "C",
  duration: [{ type: "instant" }],
  entries: ["A target must succeed on a Dexterity saving throw or take {@damage 2d6} acid damage."],
};

describe("spellEntrySchema", () => {
  it("accepts a spell shaped like the upstream corpus", () => {
    const parsed: SpellEntry = spellEntrySchema.parse(acidSplash);
    expect(parsed).toEqual(acidSplash);
  });

  it("rejects a level outside 0-9, naming the field", () => {
    const result = spellEntrySchema.safeParse({ ...acidSplash, level: 10 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["level"]);
  });

  it("rejects a spell with no duration span", () => {
    const result = spellEntrySchema.safeParse({ ...acidSplash, duration: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["duration"]);
  });

  it("keeps a field this schema does not model, such as range or components", () => {
    const withUnmodeledFields = {
      ...acidSplash,
      range: { type: "point", distance: { type: "feet", amount: 60 } },
      components: { v: true, s: true },
    };
    expect(spellEntrySchema.parse(withUnmodeledFields)).toEqual(withUnmodeledFields);
  });

  /**
   * The decision this schema makes is the shape, not a second renderer: homebrew text
   * reaches `packages/tags` exactly as catalog text does, with no branch for where the
   * string came from.
   */
  it("tokenizes {@damage} inside a parsed spell's entries through the existing tag parser", () => {
    const parsed = spellEntrySchema.parse(acidSplash);
    const prose = parsed.entries?.[0];
    if (typeof prose !== "string") throw new Error("unreachable");
    const tokens = parseTags(prose);
    const roll = tokens.find(
      (token): token is Extract<Token, { kind: "roll" }> => token.kind === "roll",
    );
    expect(roll).toEqual({ kind: "roll", notation: "2d6", display: "2d6", rollable: true });
  });
});

describe("homebrewSpellInputSchema", () => {
  it("accepts the shape without a source", () => {
    const { source: _source, ...withoutSource } = acidSplash;
    const parsed = homebrewSpellInputSchema.parse({ ...withoutSource, edition: "one" });
    expect(parsed).toMatchObject(withoutSource);
  });

  it("rejects an edition outside the two rulesets", () => {
    const { source: _source, ...withoutSource } = acidSplash;
    const result = homebrewSpellInputSchema.safeParse({ ...withoutSource, edition: "3.5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["edition"]);
  });
});

describe("homebrewSpellRecordSchema", () => {
  it("accepts a stored row", () => {
    const record = {
      id: "1",
      name: "Acid Splash",
      edition: "one",
      level: 0,
      school: "C",
      concentration: false,
      ritual: false,
      json: { ...acidSplash, source: "HB" },
      createdAt: new Date(0).toISOString(),
    };
    expect(homebrewSpellRecordSchema.parse(record)).toEqual(record);
  });
});

describe("spellRecordSchema", () => {
  it("accepts a catalog row, keyed by name and source rather than id", () => {
    const record = {
      name: "Acid Splash",
      source: "PHB",
      edition: "one",
      level: 0,
      school: "C",
      concentration: false,
      ritual: false,
      json: acidSplash,
    };
    expect(spellRecordSchema.parse(record)).toEqual(record);
  });
});
