import {
  appliedBackgroundFieldsSchema,
  appliedClassFieldsSchema,
  appliedFeatFieldsSchema,
  appliedItemFieldsSchema,
  appliedRaceFieldsSchema,
  appliedSkillFieldsSchema,
  appliedSpellFieldsSchema,
  classEntries,
  type Entries,
  type HomebrewBackgroundInput,
  type HomebrewFeatInput,
  type HomebrewItemInput,
  type HomebrewSpellInput,
  homebrewSkillInputSchema,
  homebrewSpellInputSchema,
  itemEntries,
  rowEntries,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { type ComponentType, createElement, type ReactNode } from "react";
import type { z } from "zod";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import {
  backgroundFacts,
  classFacts,
  type Fact,
  featFacts,
  raceFacts,
  skillFacts,
} from "../../lib/homebrewOptionFacts.ts";
import {
  BACKGROUND_STARTERS,
  CLASS_STARTERS,
  FEAT_STARTERS,
  type HomebrewStarters,
  ITEM_STARTERS,
  RACE_STARTERS,
  SKILL_STARTERS,
  SPELL_STARTERS,
} from "../../lib/homebrewStarters.ts";
import { BackgroundAbilityScores } from "./BackgroundAbilityScores.tsx";
import { BackgroundEquipment } from "./BackgroundEquipment.tsx";
import { BackgroundFeat } from "./BackgroundFeat.tsx";
import { BackgroundProficiencies } from "./BackgroundProficiencies.tsx";
import { ClassBasics } from "./ClassBasics.tsx";
import { ClassEquipment } from "./ClassEquipment.tsx";
import { ClassMulticlassing } from "./ClassMulticlassing.tsx";
import { ClassProficiencies } from "./ClassProficiencies.tsx";
import { ClassSpellcasting } from "./ClassSpellcasting.tsx";
import { FeatAbilityScores } from "./FeatAbilityScores.tsx";
import { FeatBasics } from "./FeatBasics.tsx";
import { FeatPrerequisites } from "./FeatPrerequisites.tsx";
import { FeatProficiencies } from "./FeatProficiencies.tsx";
import { FieldReference } from "./FieldReference.tsx";
import { homebrewBackgroundFormSchema } from "./homebrewBackgroundChecks.ts";
import { homebrewClassFormSchema } from "./homebrewClassChecks.ts";
import { type HomebrewFormProps, numberAt } from "./homebrewEntry.ts";
import { itemFacts, spellFacts } from "./homebrewFacts.ts";
import { homebrewFeatFormSchema } from "./homebrewFeatChecks.ts";
import { homebrewItemFormSchema } from "./homebrewItemChecks.ts";
import { homebrewRaceFormSchema } from "./homebrewRaceChecks.ts";
import { isVersatile, itemGroup } from "./homebrewVocabulary.ts";
import { ItemBasics } from "./ItemBasics.tsx";
import { ItemCombat } from "./ItemCombat.tsx";
import { ItemDefenses } from "./ItemDefenses.tsx";
import { ItemEffects } from "./ItemEffects.tsx";
import { ItemMagic } from "./ItemMagic.tsx";
import { ItemRulesText } from "./ItemRulesText.tsx";
import { ITEM_JSON_SCHEMA } from "./itemJsonSchema.ts";
import type { JsonEditorProps } from "./JsonEditor.tsx";
import { RaceAbilityScores } from "./RaceAbilityScores.tsx";
import { RaceBasics } from "./RaceBasics.tsx";
import { RaceProficiencies } from "./RaceProficiencies.tsx";
import { RaceSenses } from "./RaceSenses.tsx";
import { RaceSpeed } from "./RaceSpeed.tsx";
import { SkillBasics } from "./SkillBasics.tsx";
import { SpellBasics } from "./SpellBasics.tsx";
import { SpellCasting } from "./SpellCasting.tsx";
import { SpellEffect } from "./SpellEffect.tsx";
import { withUpcastNameFor } from "./spellUpcast.ts";

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

/** A kind of homebrew as the editor edits it: its input schema, its form and its preview. */
export interface EditingKind<I extends HomebrewInput = HomebrewInput> {
  inputSchema: z.ZodType<I>;
  /**
   * What the preview prints ahead of the rules text of an entry `inputSchema` accepted. A
   * method, so a kind of a narrower input still counts as an `EditingKind`.
   */
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

const item: EditingKind<HomebrewItemInput> = {
  inputSchema: homebrewItemFormSchema,
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
  reference: createElement(FieldReference, { schema: appliedItemFieldsSchema }),
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

const spell: EditingKind<HomebrewSpellInput> = {
  inputSchema: homebrewSpellInputSchema,
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
  reference: createElement(FieldReference, { schema: appliedSpellFieldsSchema }),
  shownKeys: () => ["name", "level", "school", "duration", "meta", "entries"],
};

const RACE_GRANTS = [
  "skillProficiencies",
  "toolProficiencies",
  "armorProficiencies",
  "weaponProficiencies",
  "languageProficiencies",
];

const race: EditingKind<z.infer<typeof homebrewRaceFormSchema>> = {
  inputSchema: homebrewRaceFormSchema,
  facts: raceFacts,
  entries: rowEntries,
  starters: RACE_STARTERS,
  sections: [
    { title: "Basics", Fields: RaceBasics, keys: ["name", "size"] },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
    { title: "Speed", Fields: RaceSpeed, keys: ["speed"] },
    { title: "Ability scores", Fields: RaceAbilityScores, keys: ["ability"] },
    {
      title: "Senses",
      Fields: RaceSenses,
      keys: ["senses", "darkvision", "blindsight", "tremorsense", "truesight"],
    },
    {
      title: "Defenses",
      Fields: ItemDefenses,
      keys: ["resist", "immune", "vulnerable", "conditionImmune"],
    },
    { title: "Proficiencies", Fields: RaceProficiencies, keys: RACE_GRANTS },
  ],
  reference: createElement(FieldReference, { schema: appliedRaceFieldsSchema }),
  shownKeys: () => ["name", "size", "entries", "speed", "ability", "senses", ...RACE_GRANTS],
};

const klass: EditingKind<z.infer<typeof homebrewClassFormSchema>> = {
  inputSchema: homebrewClassFormSchema,
  // `classEntries` already prints the hit die and saving throws.
  facts: (input) => classFacts(input).filter(([label]) => label === "Primary Ability"),
  entries: classEntries,
  starters: CLASS_STARTERS,
  sections: [
    { title: "Basics", Fields: ClassBasics, keys: ["name", "hd", "proficiency", "primaryAbility"] },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
    { title: "Proficiencies", Fields: ClassProficiencies, keys: ["startingProficiencies"] },
    { title: "Equipment", Fields: ClassEquipment, keys: ["startingEquipment"] },
    { title: "Multiclassing", Fields: ClassMulticlassing, keys: ["multiclassing"] },
    {
      title: "Spellcasting",
      Fields: ClassSpellcasting,
      keys: ["spellcastingAbility", "casterProgression"],
    },
  ],
  reference: createElement(FieldReference, { schema: appliedClassFieldsSchema }),
  shownKeys: () => [
    "name",
    "hd",
    "proficiency",
    "primaryAbility",
    "entries",
    "startingProficiencies",
    "startingEquipment",
    "multiclassing",
    "spellcastingAbility",
    "casterProgression",
  ],
};

const background: EditingKind<HomebrewBackgroundInput> = {
  inputSchema: homebrewBackgroundFormSchema,
  facts: backgroundFacts,
  entries: rowEntries,
  starters: BACKGROUND_STARTERS,
  sections: [
    { title: "Basics", Fields: FeatBasics, keys: ["name"] },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
    {
      title: "Proficiencies",
      Fields: BackgroundProficiencies,
      keys: ["skillProficiencies", "toolProficiencies", "languageProficiencies"],
    },
    { title: "Ability scores", Fields: BackgroundAbilityScores, keys: ["ability"] },
    { title: "Feat", Fields: BackgroundFeat, keys: ["feats"] },
    { title: "Equipment", Fields: BackgroundEquipment, keys: ["startingEquipment"] },
  ],
  reference: createElement(FieldReference, { schema: appliedBackgroundFieldsSchema }),
  shownKeys: () => [
    "name",
    "entries",
    "skillProficiencies",
    "toolProficiencies",
    "languageProficiencies",
    "ability",
    "feats",
    "startingEquipment",
  ],
};

const FEAT_PROFICIENCIES = [
  "skillProficiencies",
  "expertise",
  "toolProficiencies",
  "armorProficiencies",
  "weaponProficiencies",
  "languageProficiencies",
];

const feat: EditingKind<HomebrewFeatInput> = {
  inputSchema: homebrewFeatFormSchema,
  facts: featFacts,
  entries: rowEntries,
  starters: FEAT_STARTERS,
  sections: [
    { title: "Basics", Fields: FeatBasics, keys: ["name"] },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
    { title: "Prerequisites", Fields: FeatPrerequisites, keys: ["prerequisite"] },
    {
      title: "Ability scores",
      Fields: FeatAbilityScores,
      keys: ["ability", "savingThrowProficiencies"],
    },
    { title: "Proficiencies", Fields: FeatProficiencies, keys: FEAT_PROFICIENCIES },
  ],
  reference: createElement(FieldReference, { schema: appliedFeatFieldsSchema }),
  shownKeys: () => [
    "name",
    "entries",
    "prerequisite",
    "ability",
    "savingThrowProficiencies",
    ...FEAT_PROFICIENCIES,
  ],
};

const skill: EditingKind<z.infer<typeof homebrewSkillInputSchema>> = {
  inputSchema: homebrewSkillInputSchema,
  facts: skillFacts,
  entries: rowEntries,
  starters: SKILL_STARTERS,
  sections: [
    { title: "Basics", Fields: SkillBasics, keys: ["name", "ability"] },
    { title: "Rules text", Fields: ItemRulesText, keys: ["entries"] },
  ],
  reference: createElement(FieldReference, { schema: appliedSkillFieldsSchema }),
  shownKeys: () => ["name", "ability", "entries"],
};

/** How the editor edits each kind; `LISTING_KINDS` holds how a list names it. */
export const EDITING_KINDS: Record<HomebrewCollection, EditingKind> = {
  items: item,
  spells: spell,
  races: race,
  classes: klass,
  backgrounds: background,
  feats: feat,
  skills: skill,
};

/** How many sections a step sets side by side, which the wide modal holds two of. */
const PER_STEP = 2;

/** The kind's sections, two to a step, a step titled by its sections. */
export function stepsOf(kind: EditingKind): { title: string; sections: HomebrewSection[] }[] {
  const steps = [];
  for (let at = 0; at < kind.sections.length; at += PER_STEP) {
    const sections = kind.sections.slice(at, at + PER_STEP);
    steps.push({ title: sections.map(({ title }) => title).join(" & "), sections });
  }
  return steps;
}

/** The step that shows a problem with the top-level field `key`; the last, where none lists it. */
export function stepOf(kind: EditingKind, key: string): number {
  const at = kind.sections.findIndex(({ keys }) => keys.includes(key));
  return Math.floor((at === -1 ? kind.sections.length - 1 : at) / PER_STEP);
}
