import { describe, expect, it } from "vitest";
import { characterPagesSchema, degradePageBlock, newPageSlug, PRESET_PAGES } from "./index.ts";

describe("pages", () => {
  const page = { slug: "grapple", title: "Grapple", blocks: [] };

  it("seeds presets that parse as a character's pages", () => {
    expect(characterPagesSchema.parse(PRESET_PAGES)).toEqual(PRESET_PAGES);
  });

  it.each([
    { kind: "tarot", deck: "Many Things" },
    { kind: "section", section: "grappling" },
    { kind: "section", section: "spells", filter: "concentration" },
    {},
  ])("refuses the block %j, so no stored page holds one", (block) => {
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(false);
  });

  it("defaults a page to shown", () => {
    expect(characterPagesSchema.parse([page])[0]?.hidden).toBe(false);
  });

  it("refuses a title of only whitespace, which would leave a link with no name", () => {
    expect(characterPagesSchema.safeParse([{ ...page, title: "  " }]).success).toBe(false);
  });

  it("refuses two pages under one slug", () => {
    expect(characterPagesSchema.safeParse([page, { ...page, title: "Again" }]).success).toBe(false);
  });

  it.each(["", "Grapple", "grapple rules", "grapple--rules", "-grapple", "grapple/rules"])(
    "refuses the slug %j, which a URL would not carry as written",
    (slug) => {
      expect(characterPagesSchema.safeParse([{ ...page, slug }]).success).toBe(false);
    },
  );

  it.each([
    { kind: "value", field: "armorClass" },
    { kind: "list", source: "spells", filter: { levels: [1, 3], prepared: true, search: "fire" } },
    { kind: "list", source: "inventory", filter: { equipped: true } },
    { kind: "text", text: "{@spell fireball} at the ready." },
  ])("accepts the block %j", (block) => {
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(true);
  });

  it("refuses a value block naming a field nothing derives", () => {
    const block = { kind: "value", field: "speed" };
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(false);
  });

  it.each([
    { kind: "list", source: "inventory", filter: { levels: [3] } },
    { kind: "list", source: "features", filter: { prepared: true } },
    { kind: "list", source: "spells", filter: { equipped: true } },
    { kind: "list", source: "spells", filter: { levels: [10] } },
    { kind: "list", source: "spells", filter: { levels: [] } },
    { kind: "list", source: "spells", filter: { school: "evocation" } },
  ])("refuses the list block %j, whose filter that list cannot apply", (block) => {
    expect(characterPagesSchema.safeParse([{ ...page, blocks: [block] }]).success).toBe(false);
  });

  it.each([
    ["Grapple Rules", [], "grapple-rules"],
    ["  Café & Bar!  ", [], "cafe-bar"],
    ["???", [], "page"],
    ["Grapple", ["grapple", "grapple-2"], "grapple-3"],
  ])("slugs a new page titled %j beside %j as %j", (title, taken, slug) => {
    expect(newPageSlug(title, taken)).toBe(slug);
    expect(characterPagesSchema.safeParse([{ ...page, slug }]).success).toBe(true);
  });

  it("defaults a list block's filter to empty", () => {
    const [parsed] = characterPagesSchema.parse([
      { ...page, blocks: [{ kind: "list", source: "inventory" }] },
    ]);
    expect(parsed?.blocks).toEqual([{ kind: "list", source: "inventory", filter: {} }]);
  });

  describe("degradePageBlock", () => {
    it("passes a known block through unchanged", () => {
      const block = { kind: "text", text: "notes" };
      expect(degradePageBlock(block)).toEqual(block);
    });

    it.each([
      { kind: "tarot", deck: "Many Things" },
      { kind: "section", section: "grappling" },
      {},
    ])("wraps the refused block %j as unknown, carrying the original data", (raw) => {
      expect(degradePageBlock(raw)).toEqual({ kind: "unknown", raw });
    });

    it("round-trips the wrapped block through a write", () => {
      const raw = { kind: "tarot", deck: "Many Things" };
      const degraded = degradePageBlock(raw);
      expect(characterPagesSchema.safeParse([{ ...page, blocks: [degraded] }]).success).toBe(true);
    });
  });
});
