import {
  type Entries,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
  itemHitFacts,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import type { z } from "zod";
import { itemMeta } from "../../lib/itemKind.ts";
import { schoolName } from "../../lib/spellSchool.ts";

/** What every homebrew record carries, whichever kind it is. */
export interface HomebrewRow {
  id: string;
  name: string;
  edition: CharacterRecord["edition"];
  json: { entries?: Entries };
}

/** A kind of homebrew the Homebrew settings page edits: its route, its schemas and its chips. */
export interface HomebrewKind<R extends HomebrewRow = HomebrewRow> {
  collection: "items" | "spells";
  noun: string;
  heading: string;
  recordSchema: z.ZodType<R>;
  inputSchema: z.ZodType<unknown>;
  /** A method, so a kind of a narrower record still counts as a `HomebrewKind`. */
  chips(record: R): string[];
  placeholder: string;
}

const item: HomebrewKind<z.infer<typeof homebrewItemRecordSchema>> = {
  collection: "items",
  noun: "item",
  heading: "Items",
  recordSchema: homebrewItemRecordSchema,
  inputSchema: homebrewItemInputSchema,
  chips: (record) => [itemMeta(itemHitFacts(record.json))],
  placeholder:
    '{\n  "name": "Sunfire Blade",\n  "type": "M",\n  "rarity": "rare",\n  "weaponCategory": "martial",\n  "dmg1": "1d8",\n  "dmgType": "S",\n  "entries": ["This blade deals an extra {@damage 1d6} fire damage."]\n}',
};

const spell: HomebrewKind<z.infer<typeof homebrewSpellRecordSchema>> = {
  collection: "spells",
  noun: "spell",
  heading: "Spells",
  recordSchema: homebrewSpellRecordSchema,
  inputSchema: homebrewSpellInputSchema,
  chips: (record) => [
    record.level === 0 ? "Cantrip" : `Level ${record.level}`,
    schoolName(record.school),
    ...(record.concentration ? ["Concentration"] : []),
    ...(record.ritual ? ["Ritual"] : []),
  ],
  placeholder:
    '{\n  "name": "Coastal Ward",\n  "level": 2,\n  "school": "A",\n  "duration": [{ "type": "timed", "duration": { "type": "minute", "amount": 1 } }],\n  "entries": ["A wave of brine hardens into a barrier for {@dice 1d4} rounds."]\n}',
};

/** The kinds in the order the page lists them. */
export const HOMEBREW_KINDS: HomebrewKind[] = [item, spell];
