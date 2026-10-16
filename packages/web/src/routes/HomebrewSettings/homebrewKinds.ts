import {
  type Entries,
  type HomebrewItemInput,
  type HomebrewSpellInput,
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
import { homebrewItemFormSchema } from "./homebrewItemChecks.ts";
import { type HomebrewStarters, ITEM_STARTERS, SPELL_STARTERS } from "./homebrewStarters.ts";
import { ItemBasics } from "./ItemBasics.tsx";
import { ItemCombat } from "./ItemCombat.tsx";
import { ItemDefenses } from "./ItemDefenses.tsx";
import { ItemEffects } from "./ItemEffects.tsx";
import { ItemFieldReference } from "./ItemFieldReference.tsx";
import { ItemMagic } from "./ItemMagic.tsx";
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

/** One section of a kind's form: its title, its fields, and the top-level keys it shows. */
export interface HomebrewSection {
  title: string;
  Fields: ComponentType<HomebrewFormProps>;
  keys: string[];
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
   * The form's sections, in order: each one's fields, and the top-level fields whose problems
   * keep its step from advancing. A field no section names belongs to the last.
   */
  sections: HomebrewSection[];
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
  inputSchema: homebrewItemFormSchema,
  chips: (record) => [itemMeta(itemHitFacts(record.json))],
  facts: itemFacts,
  entries: itemEntries,
  starters: ITEM_STARTERS,
  sections: [
    {
      title: "Basics",
      Fields: ItemBasics,
      keys: ["name", "type", "weight", "value"],
    },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
    {
      title: "Combat",
      Fields: ItemCombat,
      keys: ["weaponCategory", "dmgType", "baseItem", "dmg1", "dmg2", "property", "ac"],
    },
    {
      title: "Defenses",
      Fields: ItemDefenses,
      keys: ["resist", "immune", "vulnerable", "conditionImmune"],
    },
    {
      title: "Magic",
      Fields: ItemMagic,
      keys: [
        "rarity",
        "reqAttune",
        "bonusWeapon",
        "bonusAc",
        "bonusSavingThrow",
        "bonusSavingThrowConcentration",
        "bonusAbilityCheck",
        "bonusProficiencyBonus",
        "bonusSpellAttack",
        "bonusSpellSaveDc",
        "bonusSpellDamage",
        "critThreshold",
      ],
    },
    { title: "Effects", Fields: ItemEffects, keys: ["ability", "modifySpeed", "advantage"] },
  ],
  reference: createElement(ItemFieldReference),
  formKeys: [
    "name",
    "type",
    "rarity",
    "reqAttune",
    "advantage",
    "entries",
    "dmg1",
    "dmg2",
    "critThreshold",
  ],
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
  sections: [
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

/** How many sections a step sets side by side, which the wide modal holds two of. */
const PER_STEP = 2;

/** The kind's sections, two to a step, a step titled by its sections. */
export function stepsOf(kind: HomebrewKind): { title: string; sections: HomebrewSection[] }[] {
  const steps = [];
  for (let at = 0; at < kind.sections.length; at += PER_STEP) {
    const sections = kind.sections.slice(at, at + PER_STEP);
    steps.push({ title: sections.map(({ title }) => title).join(" & "), sections });
  }
  return steps;
}

/** The step that shows a problem with the top-level field `key`; the last, where none lists it. */
export function stepOf(kind: HomebrewKind, key: string): number {
  const at = kind.sections.findIndex(({ keys }) => keys.includes(key));
  return Math.floor((at === -1 ? kind.sections.length - 1 : at) / PER_STEP);
}
