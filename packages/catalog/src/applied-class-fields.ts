import { z } from "zod";
import { homebrewClassInputSchema, spellcastingAbilitySchema } from "./class.ts";
import { entriesSchema } from "./entry.ts";
import { multiclassEntrySchema, multiclassPrerequisiteSchema } from "./multiclass.ts";
import { classProficiencyGrantsSchema } from "./proficiency-grants.ts";
import { classSkillChoiceSchema } from "./skill-choice.ts";

/**
 * `startingEquipment`, `classFeatures` and `entriesHigherLevel` are read off the entry
 * directly, with no schema to borrow. A key several schemas read takes the shape of the last
 * spread, so the homebrew fields come last and keep the shape a homebrew save validates.
 */
const shape = {
  startingEquipment: z.looseObject({}).optional(),
  classFeatures: z.array(z.unknown()).optional(),
  entriesHigherLevel: entriesSchema.optional(),
  ...classProficiencyGrantsSchema.in.shape,
  ...classSkillChoiceSchema.in.shape,
  ...multiclassEntrySchema.in.shape,
  ...multiclassPrerequisiteSchema.in.shape,
  ...spellcastingAbilitySchema.in.shape,
  ...homebrewClassInputSchema.omit({ edition: true }).shape,
};

type Shape = typeof shape;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  name: "The class's name, as the sheet prints it for the character's levels in the class.",
  entries:
    "The rules text, {@tags} included, printed in the class's detail. The sheet lists no class features off it.",
  hd: 'The hit die, such as {"number": 1, "faces": 10} for a d10, which sets hit points and the character\'s hit dice. "number" is always 1, and "faces" is 6, 8, 10 or 12: the sheet cannot build a character holding a class of any other die.',
  spellcastingAbility:
    'The ability the class casts with, such as "int", which gives the character a spell save DC and spell attack bonus from 1st level. Creation lets the character learn spells up to 9th level, with no count; the sheet counts no spell slots for a homebrew class.',
  entriesHigherLevel: 'Further rules text, printed after "entries" in the class\'s detail.',
  proficiency:
    'Saving throw abilities, such as ["str", "con"], printed in the class\'s detail and its homebrew list entry. The sheet grants no saving throw off a homebrew class.',
  primaryAbility:
    'The primary ability, as alternatives, such as [{"str": true}] or [{"dex": true, "wis": true}]. Printed in the homebrew list entry, and in the class\'s detail as a multiclassing prerequisite of 13 where "multiclassing" states no requirements.',
  startingProficiencies:
    'Such as {"armor": ["light", "shield"], "weapons": ["simple"], "tools": ["herbalism kit"], "skills": [{"choose": {"from": ["athletics", "nature"], "count": 2}}]}, printed in the class\'s detail. The sheet grants none of them and offers no skill choice off a homebrew class.',
  multiclassing:
    'Such as {"requirements": {"str": 13}, "proficienciesGained": {"armor": ["light"]}}, printed in the class\'s detail. The sheet checks no score and grants no proficiency when a character multiclasses into a homebrew class.',
  startingEquipment:
    'Such as {"default": ["(a) a longsword or (b) two handaxes"], "goldAlternative": "125"}, printed in the class\'s detail, the gold in gp. The sheet adds none of it to the inventory.',
  classFeatures:
    'Features by level, such as ["Second Wind|Warden|Homebrew|1"], printed as the level table in the class\'s detail. A homebrew class has no feature entries, so each link finds nothing, and the sheet lists none of them.',
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off a homebrew class, each described for a table writing one.
 * Composed from the schemas that read each field, so a field one of them gains reaches this
 * list and fails typecheck until it is described. `classEntries` and `classFacts` also read
 * the entry directly; a test records what they read and fails on a field this list lacks.
 */
export const appliedClassFieldsSchema = z.object(described);
