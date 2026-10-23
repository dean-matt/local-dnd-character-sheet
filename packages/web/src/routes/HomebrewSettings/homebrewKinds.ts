import {
  classEntries,
  type Entries,
  type HomebrewItemInput,
  type HomebrewSpellInput,
  homebrewBackgroundInputSchema,
  homebrewBackgroundRecordSchema,
  homebrewClassInputSchema,
  homebrewClassRecordSchema,
  homebrewFeatInputSchema,
  homebrewFeatRecordSchema,
  homebrewItemRecordSchema,
  homebrewRaceInputSchema,
  homebrewRaceRecordSchema,
  homebrewSkillInputSchema,
  homebrewSkillRecordSchema,
  homebrewSpellInputSchema,
  homebrewSpellRecordSchema,
  itemEntries,
  itemHitFacts,
  rowEntries,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { type ComponentType, createElement, type ReactNode } from "react";
import type { z } from "zod";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import { itemMeta } from "../../lib/itemKind.ts";
import { schoolName } from "../../lib/spellSchool.ts";
import { type HomebrewFormProps, numberAt } from "./homebrewEntry.ts";
import { type Fact, itemFacts, spellFacts } from "./homebrewFacts.ts";
import { homebrewItemFormSchema } from "./homebrewItemChecks.ts";
import {
  backgroundFacts,
  classFacts,
  featFacts,
  raceFacts,
  skillFacts,
} from "./homebrewOptionFacts.ts";
import {
  BACKGROUND_STARTERS,
  CLASS_STARTERS,
  FEAT_STARTERS,
  type HomebrewStarters,
  ITEM_STARTERS,
  RACE_STARTERS,
  SKILL_STARTERS,
  SPELL_STARTERS,
} from "./homebrewStarters.ts";
import { isVersatile, itemGroup } from "./homebrewVocabulary.ts";
import { ItemBasics } from "./ItemBasics.tsx";
import { ItemCombat } from "./ItemCombat.tsx";
import { ItemDefenses } from "./ItemDefenses.tsx";
import { ItemEffects } from "./ItemEffects.tsx";
import { ItemFieldReference } from "./ItemFieldReference.tsx";
import { ItemMagic } from "./ItemMagic.tsx";
import { ItemRulesText } from "./ItemRulesText.tsx";
import { ITEM_JSON_SCHEMA } from "./itemJsonSchema.ts";
import type { JsonEditorProps } from "./JsonEditor.tsx";
import { SkillBasics } from "./SkillBasics.tsx";
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
  collection: HomebrewCollection;
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
   * keep its step from advancing. A field no section names belongs to the last. A kind with
   * none is edited as JSON alone.
   */
  sections: HomebrewSection[];
  /** What the JSON view shows beside its editor: the fields the sheet reads, where a kind lists them. */
  reference?: ReactNode;
  /** What the JSON editor suggests and marks as the user types, where a kind has one. */
  jsonSchema?: JsonEditorProps["schema"];
  /**
   * The top-level fields whose problem a control shows beside it for `entry`, which can
   * depend on what the entry is, as a weapon's damage only shows for a weapon; the step lists
   * any other problem itself, so none goes unseen.
   */
  shownKeys(entry: Record<string, unknown>): string[];
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
    {
      title: "Effects",
      Fields: ItemEffects,
      keys: ["ability", "modifySpeed", "senses", "skillProficiencies", "expertise", "advantage"],
    },
  ],
  reference: createElement(ItemFieldReference),
  jsonSchema: ITEM_JSON_SCHEMA,
  shownKeys: (entry) => [
    "name",
    "type",
    "rarity",
    "reqAttune",
    "entries",
    "ability",
    "modifySpeed",
    "senses",
    "skillProficiencies",
    "expertise",
    "advantage",
    ...(itemGroup(entry.type) === "weapon" ? ["dmg1"] : []),
    ...(itemGroup(entry.type) === "weapon" && isVersatile(entry) ? ["dmg2"] : []),
    // A bonus row shows only for a number; a non-number pasted as JSON has no row to sit beside.
    ...(numberAt(entry.critThreshold) === undefined ? [] : ["critThreshold"]),
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
  shownKeys: () => ["name", "level", "school", "duration", "meta", "entries"],
};

/** A kind edited as pasted JSON alone, its chips and preview facts read off the entry. */
function pasted<R extends HomebrewRow, I extends HomebrewInput & Record<string, unknown>>(
  kind: Pick<
    HomebrewKind<R, I>,
    "collection" | "noun" | "heading" | "recordSchema" | "inputSchema" | "starters" | "entries"
  >,
  facts: (json: Record<string, unknown>) => Fact[],
  previewed: (fact: Fact) => boolean = () => true,
): HomebrewKind<R, I> {
  return {
    ...kind,
    chips: (record) => facts(record.json).map(([, value]) => value),
    facts: (input) => facts(input).filter(previewed),
    sections: [],
    shownKeys: () => [],
  };
}

const race = pasted(
  {
    collection: "races",
    noun: "race",
    heading: "Races",
    recordSchema: homebrewRaceRecordSchema,
    inputSchema: homebrewRaceInputSchema,
    starters: RACE_STARTERS,
    entries: rowEntries,
  },
  raceFacts,
);

const klass = pasted(
  {
    collection: "classes",
    noun: "class",
    heading: "Classes",
    recordSchema: homebrewClassRecordSchema,
    inputSchema: homebrewClassInputSchema,
    starters: CLASS_STARTERS,
    entries: classEntries,
  },
  classFacts,
  // `classEntries` already prints the hit die and saving throws.
  ([label]) => label === "Primary Ability",
);

const background = pasted(
  {
    collection: "backgrounds",
    noun: "background",
    heading: "Backgrounds",
    recordSchema: homebrewBackgroundRecordSchema,
    inputSchema: homebrewBackgroundInputSchema,
    starters: BACKGROUND_STARTERS,
    entries: rowEntries,
  },
  backgroundFacts,
);

const feat = pasted(
  {
    collection: "feats",
    noun: "feat",
    heading: "Feats",
    recordSchema: homebrewFeatRecordSchema,
    inputSchema: homebrewFeatInputSchema,
    starters: FEAT_STARTERS,
    entries: rowEntries,
  },
  featFacts,
);

const skill: HomebrewKind<
  z.infer<typeof homebrewSkillRecordSchema>,
  z.infer<typeof homebrewSkillInputSchema>
> = {
  collection: "skills",
  noun: "skill",
  heading: "Skills",
  recordSchema: homebrewSkillRecordSchema,
  inputSchema: homebrewSkillInputSchema,
  chips: (record) => skillFacts(record.json).map(([, value]) => value),
  facts: skillFacts,
  entries: rowEntries,
  starters: SKILL_STARTERS,
  sections: [
    { title: "Basics", Fields: SkillBasics, keys: ["name", "ability"] },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
  ],
  shownKeys: () => ["name", "ability", "entries"],
};

/** The kinds in the order the page lists them. */
export const HOMEBREW_KINDS: HomebrewKind[] = [item, spell, race, klass, background, feat, skill];

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
