import {
  type Entries,
  type HomebrewItemInput,
  type HomebrewSpellInput,
  homebrewItemInputSchema,
  homebrewItemRecordSchema,
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
  itemHitFacts,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import type { ComponentType } from "react";
import type { z } from "zod";
import { itemMeta } from "../../lib/itemKind.ts";
import { schoolName } from "../../lib/spellSchool.ts";
import type { HomebrewFormProps } from "./homebrewEntry.ts";
import { type Fact, itemFacts, spellFacts } from "./homebrewFacts.ts";
import { type HomebrewStarters, ITEM_STARTERS, SPELL_STARTERS } from "./homebrewStarters.ts";
import { ItemForm } from "./ItemForm.tsx";
import { SpellForm } from "./SpellForm.tsx";
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
  /** What a new entry opens with; the editor offers a choice where there is more than one. */
  starters: HomebrewStarters;
  Form: ComponentType<HomebrewFormProps>;
  /** The top-level fields `Form` shows a problem beside; the editor lists any other problem itself. */
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
  starters: ITEM_STARTERS,
  Form: ItemForm,
  formKeys: ["name", "type", "rarity", "reqAttune", "entries"],
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
  Form: SpellForm,
  facts: spellFacts,
  forEdition: withUpcastNameFor,
  formKeys: ["name", "level", "school", "duration", "meta", "entries"],
};

/** The kinds in the order the page lists them. */
export const HOMEBREW_KINDS: HomebrewKind[] = [item, spell];
