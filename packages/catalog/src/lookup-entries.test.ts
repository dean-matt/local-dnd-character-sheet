import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogRowEntries } from "./index.ts";

const FIXTURES = join(import.meta.dirname, "../../../tests/fixtures/5etools/data");

/** A row from the generated fixtures, which keep upstream's fields and elide its prose. */
function fixture(file: string, key: string, name: string, source: string, pantheon?: string) {
  const rows: Record<string, unknown>[] = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"))[
    key
  ];
  const row = rows.find(
    (one) =>
      one.name === name &&
      one.source === source &&
      (pantheon === undefined || one.pantheon === pantheon),
  );
  if (!row) throw new Error(`no fixture ${name} (${source})`);
  return row;
}

const deity = (name: string, source: string, pantheon: string) =>
  catalogRowEntries("deity", fixture("deities.json", "deity", name, source, pantheon));

const language = (name: string, source: string) =>
  catalogRowEntries("language", fixture("languages.json", "language", name, source));

describe("a deity's detail", () => {
  it("shows each field ahead of the deity's prose", () => {
    expect(deity("Abbathor", "MTF", "Dwarven")).toEqual([
      "{@b Pantheon} Dwarven",
      "{@b Alignment} Neutral evil",
      "{@b Domains} Trickery",
      "{@b Province} Greed",
      "{@b Symbol} Jeweled dagger, point down",
      "Elided.",
      "Elided.",
      "Elided.",
    ]);
  });

  it("leaves out a field the deity lacks, and shows no prose where it has none", () => {
    expect(deity("Moradin", "PHB", "Nonhuman")).toEqual([
      "{@b Pantheon} Nonhuman",
      "{@b Alignment} Lawful good",
      "{@b Domains} Forge, Knowledge",
      "{@b Symbol} Hammer and anvil",
    ]);
  });

  it("reads a single-letter alignment", () => {
    expect(deity("Oghma", "PHB", "Forgotten Realms")).toContain("{@b Alignment} Neutral");
  });
});

describe("a language's detail", () => {
  it("shows its type, script and typical speakers ahead of its prose", () => {
    expect(language("Draconic", "PHB")).toEqual([
      "{@b Type} Exotic",
      "{@b Script} Draconic",
      "{@b Typical Speakers} {@filter dragons|bestiary|type=dragon}, {@race dragonborn}",
      "Elided.",
    ]);
  });

  it("shows a language with no prose by its fields alone", () => {
    expect(language("Common", "PHB")).toEqual([
      "{@b Type} Standard",
      "{@b Script} Common",
      "{@b Typical Speakers} {@filter humans|bestiary|type=humanoid|tag=any race;human}",
    ]);
  });

  it("shows a 2024 language's origin, which stands where typical speakers would", () => {
    expect(language("Common", "XPHB")).toEqual(["{@b Type} Standard", "{@b Origin} Sigil"]);
  });

  it("is empty for a language with no field to show", () => {
    expect(catalogRowEntries("language", { name: "Olman", source: "TftYP", page: 238 })).toEqual(
      [],
    );
  });
});
