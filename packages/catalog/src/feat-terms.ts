import { ABILITIES, SIZES } from "@dnd/rules";
import { z } from "zod";
import type { ScoreMinimums } from "./multiclass.ts";

/** A race a feat names, lowercased as upstream writes it: `elf`, or `elf` and `drow`. */
export type RacePrerequisite = { name: string; subrace?: string };

/** An armor or weapon category a feat needs proficiency in, lowercased: `heavy`, `martial`. */
type ProficiencyPrerequisite = { armor?: string; weapon?: string };

/**
 * One way to meet a feat's prerequisite, every part of which must hold: a character level
 * and a class the character holds; scores, races and proficiencies, any one of each list
 * sufficing — `Ritual Caster` (PHB) needs 13 in Intelligence or Wisdom; `feats`, any one
 * held, keyed `name|source` lowercased; `features`, groups of class or subclass feature
 * names, one of each group held; and `spell`, the ability to cast any spell at all. An
 * absent part or an empty list needs nothing.
 */
export type FeatPrerequisite = {
  level?: number;
  className?: string;
  scores: ScoreMinimums[];
  races: RacePrerequisite[];
  proficiencies: ProficiencyPrerequisite[];
  feats: string[];
  features: string[][];
  spell: boolean;
};

const scoresSchema = z
  .array(z.partialRecord(z.enum(ABILITIES), z.int()))
  .optional()
  .catch(undefined)
  .transform((scores): ScoreMinimums[] => scores ?? []);

const levelSchema = z
  .union([z.int(), z.looseObject({ level: z.int(), class: z.looseObject({ name: z.string() }) })])
  .optional()
  .catch(undefined)
  .transform((level) =>
    typeof level === "object" ? { level: level.level, className: level.class.name } : { level },
  );

const SIZE_RACES = new Set(SIZES.map((size) => `${size} race`));

const racesSchema = z
  .array(z.looseObject({ name: z.string(), subrace: z.string().optional().catch(undefined) }))
  .optional()
  .catch(undefined)
  .transform((races = []): RacePrerequisite[] => {
    const named = races.map(({ name, subrace }) => ({
      name: name.toLowerCase(),
      ...(subrace === undefined ? {} : { subrace: subrace.toLowerCase() }),
    }));
    // A size such as `small race` is an alternative unread, so the whole list reads as met.
    return named.some(({ name }) => SIZE_RACES.has(name)) ? [] : named;
  });

const proficienciesSchema = z
  .array(
    z.looseObject({
      armor: z.string().optional().catch(undefined),
      weapon: z.string().optional().catch(undefined),
      weaponGroup: z.string().optional().catch(undefined),
    }),
  )
  .optional()
  .catch(undefined)
  .transform((proficiencies): ProficiencyPrerequisite[] =>
    (proficiencies ?? []).map(({ armor, weapon, weaponGroup }) => {
      const held = weapon ?? weaponGroup;
      return {
        ...(armor === undefined ? {} : { armor: armor.toLowerCase() }),
        ...(held === undefined ? {} : { weapon: held.toLowerCase() }),
      };
    }),
  );

/** `aberrant dragonmark|efa`, or with a display name after a third bar, as `name|source`. */
const featsSchema = z
  .array(z.string())
  .optional()
  .catch(undefined)
  .transform((feats) =>
    (feats ?? []).map((feat) => feat.toLowerCase().split("|").slice(0, 2).join("|")),
  );

const flagSchema = z.literal(true).optional().catch(undefined);

const prerequisiteSchema = z
  .looseObject({
    level: levelSchema,
    ability: scoresSchema,
    race: racesSchema,
    proficiency: proficienciesSchema,
    feat: featsSchema,
    feature: z.array(z.string()).optional().catch(undefined),
    spellcasting: flagSchema,
    spellcasting2020: flagSchema,
    spellcastingFeature: flagSchema,
  })
  .transform((row): FeatPrerequisite => {
    const { level: at, className } = row.level;
    const features = [
      row.feature ?? [],
      row.spellcasting2020 ? ["Spellcasting", "Pact Magic"] : [],
      row.spellcastingFeature ? ["Spellcasting"] : [],
    ].filter((group) => group.length > 0);
    return {
      ...(at === undefined ? {} : { level: at }),
      ...(className === undefined ? {} : { className }),
      scores: row.ability,
      races: row.race,
      proficiencies: row.proficiency,
      feats: row.feat,
      features,
      spell: row.spellcasting === true,
    };
  });

/**
 * What a feat row says about who may take it: its 2024 category — `G` general, `O`
 * origin, `EB` epic boon, `FS` fighting style — whether it may be taken more than once,
 * and its prerequisites as alternatives, any one of which qualifies. An empty list needs
 * nothing.
 *
 * A campaign, a background, a feat category held (`featCategory`) or not held
 * (`exclusiveFeatCategory`), a race given as a size (`small race`) and free text go
 * unread, so an alternative needing only those reads as met: `Rune Shaper` (BGG) is open
 * to everyone through its `Rune Carver` background. Reading each against the definition
 * is the way out. A malformed field reads as absent rather than refusing
 * the row.
 */
export const featTermsSchema = z
  .looseObject({
    category: z.string().optional().catch(undefined),
    repeatable: z.boolean().optional().catch(undefined),
    prerequisite: z.array(prerequisiteSchema).optional().catch(undefined),
  })
  .transform(({ category, repeatable, prerequisite }) => ({
    category,
    repeatable: repeatable === true,
    prerequisites: prerequisite ?? [],
  }));
