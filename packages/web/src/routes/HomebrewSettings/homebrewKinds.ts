import {
  type Entries,
  type HomebrewItemInput,
  type HomebrewSpellInput,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
  itemEntries,
  itemHitFacts,
  rowEntries,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { type ComponentType, createElement, type ReactNode } from "react";
import type { z } from "zod";
import { itemMeta } from "../../lib/itemKind.ts";
import { schoolName } from "../../lib/spellSchool.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { type Fact, itemFacts, spellFacts } from "./homebrewFacts.ts";
import { type HomebrewStarters, ITEM_STARTERS, SPELL_STARTERS } from "./homebrewStarters.ts";
import { ItemBasics } from "./ItemBasics.tsx";
import { ItemDefenses } from "./ItemDefenses.tsx";
import { ItemFieldReference } from "./ItemFieldReference.tsx";
import { ItemRulesText } from "./ItemRulesText.tsx";
import { SpellBasics } from "./SpellBasics.tsx";
import { SpellCasting } from "./SpellCasting.tsx";
import { SpellEffect } from "./SpellEffect.tsx";
import { withUpcastNameFor } from "./spellUpcast.ts";

/** What every homebrew record carries, whichever kind it is. */
export interface HomebrewRow {
  id: string;
  name: string;
  edition: CharacterRecord["edition"];
  json: { entries?: Entries };
}

/** What every kind's input schema accepts, whichever kind it is. */
export interface HomebrewInput {
  name: string;
  edition: CharacterRecord["edition"];
  entries?: Entries;
}

/** A kind of homebrew the Homebrew settings page edits: its route, its schemas and its chips. */
export interface HomebrewKind<
  R extends HomebrewRow = HomebrewRow,
  I extends HomebrewInput = HomebrewInput,
> {
  collection: "items" | "spells";
  noun: string;
  heading: string;
  recordSchema: z.ZodType<R>;
  inputSchema: z.ZodType<I>;
  /** A method, so a kind of a narrower record still counts as a `HomebrewKind`. */
  chips(record: R): string[];
  /** What the preview prints ahead of the rules text of an entry `inputSchema` accepted. */
  facts(input: I): Fact[];
  /** The rules text the preview prints, as the saved row's detail reads it. */
  entries(input: I): Entries;
  /** What a new entry opens with; the editor offers a choice where there is more than one. */
  starters: HomebrewStarters;
  /**
   * The form's steps, in order: each one's fields, and the top-level fields whose problems
   * keep it from advancing. A field no step names is checked at the review that follows them.
   */
  steps: { title: string; Fields: ComponentType<HomebrewFormProps>; keys: string[] }[];
  /** What the JSON view shows beside its editor: the fields the sheet reads, where a kind lists them. */
  reference?: ReactNode;
  /** The top-level fields a step shows a problem beside; the editor lists any other problem itself. */
  formKeys: string[];
  /** The entry as the edition picked next would write it, where an edition changes how it reads. */
  forEdition?(
    entry: Record<string, unknown>,
    edition: CharacterRecord["edition"],
  ): Record<string, unknown>;
}

const item: HomebrewKind<z.infer<typeof homebrewItemRecordSchema>, HomebrewItemInput> = {
  collection: "items",
  noun: "item",
  heading: "Items",
  recordSchema: homebrewItemRecordSchema,
  inputSchema: homebrewItemInputSchema,
  chips: (record) => [itemMeta(itemHitFacts(record.json))],
  facts: itemFacts,
  entries: itemEntries,
  starters: ITEM_STARTERS,
  steps: [
    {
      title: "Basics",
      Fields: ItemBasics,
      keys: [
        "name",
        "type",
        "rarity",
        "weight",
        "value",
        "reqAttune",
        "weaponCategory",
        "dmgType",
        "baseItem",
        "dmg1",
        "dmg2",
        "bonusWeapon",
        "property",
        "ac",
        "bonusAc",
      ],
    },
    {
      title: "Defenses",
      Fields: ItemDefenses,
      keys: ["resist", "immune", "conditionImmune", "advantage"],
    },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
  ],
  reference: createElement(ItemFieldReference),
  formKeys: ["name", "type", "rarity", "reqAttune", "advantage", "entries"],
};

const spell: HomebrewKind<z.infer<typeof homebrewSpellRecordSchema>, HomebrewSpellInput> = {
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
  starters: SPELL_STARTERS,
  steps: [
    { title: "Basics", Fields: SpellBasics, keys: ["name", "level", "school"] },
    {
      title: "Casting",
      Fields: SpellCasting,
      keys: ["time", "range", "duration", "components", "meta"],
    },
    {
      title: "Effect",
      Fields: SpellEffect,
      keys: ["damageInflict", "entries", "entriesHigherLevel"],
    },
  ],
  facts: spellFacts,
  entries: rowEntries,
  forEdition: withUpcastNameFor,
  formKeys: ["name", "level", "school", "duration", "meta", "entries"],
};

/** The kinds in the order the page lists them. */
export const HOMEBREW_KINDS: HomebrewKind[] = [item, spell];

/** The step that shows a problem with the top-level field `key`; the last, where none lists it. */
export function stepOf(kind: HomebrewKind, key: string): number {
  const at = kind.steps.findIndex(({ keys }) => keys.includes(key));
  return at === -1 ? kind.steps.length - 1 : at;
}
