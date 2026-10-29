import { z } from "zod";
import { homebrewFeatInputSchema } from "./character-options.ts";
import { defenseTraitSchema } from "./defense.ts";
import { entriesSchema } from "./entry.ts";
import { featTermsSchema } from "./feat-terms.ts";
import { grantedSchema, proficiencyGrantsSchema } from "./proficiency-grants.ts";
import { senseGrantsSchema } from "./sense.ts";

/**
 * `featGrantsSchema` reads `savingThrowProficiencies`, `expertise` and
 * `skillToolLanguageProficiencies` off the entry directly, and `rowEntries` reads
 * `entriesHigherLevel`, with no schema to borrow. `ability` is left out: the sheet places no
 * increase a homebrew feat prints.
 */
const shape = {
  entriesHigherLevel: entriesSchema.optional(),
  savingThrowProficiencies: grantedSchema,
  expertise: grantedSchema,
  skillToolLanguageProficiencies: z.array(z.unknown()).optional(),
  ...featTermsSchema.in.shape,
  ...proficiencyGrantsSchema.in.shape,
  ...defenseTraitSchema.in.pick({ resist: true, immune: true, conditionImmune: true }).shape,
  ...senseGrantsSchema.in.shape,
  ...homebrewFeatInputSchema.omit({ edition: true }).shape,
};

type Shape = typeof shape;

const UNASKED = "A pick grants nothing: the sheet asks no pick a homebrew feat offers.";

const granted = (what: string, example: string) =>
  `${what} the feat grants, such as [${example}], each set true; a list of several alternatives grants none of them. ${UNASKED}`;

const range = (sense: string) => `${sense} range in feet, such as 60.`;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  name: "The feat's name, which heads its rules text among the character's features.",
  entries:
    "The rules text, {@tags} included, listed whole among the character's features under the feat's name.",
  entriesHigherLevel: 'Further rules text, printed after "entries" in the feat\'s detail.',
  category:
    'The 2024 category: "G" general, "O" origin, "EB" epic boon or "FS" fighting style. A 2024 character\'s Ability Score Improvement offers only a "G", "O" or "EB" feat, and a background offering any feat of a category offers this one under its own.',
  repeatable: "true lets a character take the feat again at a later improvement.",
  prerequisite:
    'Alternatives, any one of which lets a character take the feat, each needing every part it states: "level", such as 4 or {"level": 4, "class": {"name": "Fighter"}}; "ability", such as [{"str": 13}]; "race", such as [{"name": "elf"}]; "proficiency", such as [{"armor": "heavy"}]; "feat", such as ["grappler|phb"]; "feature", class feature names; or "spellcasting", "spellcasting2020" or "spellcastingFeature" set true. Any other part reads as met. The feat\'s homebrew list entry prints them.',
  savingThrowProficiencies: granted("Saving throws", '{"con": true}'),
  expertise: granted("Skills given expertise", '{"perception": true}'),
  skillProficiencies: granted("Skills", '{"perception": true}'),
  languageProficiencies: granted("Languages", '{"elvish": true}'),
  toolProficiencies: granted("Tools", '{"thieves\' tools": true}'),
  weaponProficiencies: granted("Weapons or weapon categories", '{"longsword|phb": true}'),
  armorProficiencies: granted("Armor categories", '{"light": true, "shield": true}'),
  skillToolLanguageProficiencies: `Read only for a pick of skills or tools, such as [{"choose": [{"from": ["anySkill", "anyTool"], "count": 3}]}]. ${UNASKED}`,
  resist: `Damage types resisted, such as ["fire"]; {"choose": {"from": ["cold", "fire"]}} in the list is a pick. ${UNASKED}`,
  immune: 'Damage types the character is immune to, such as ["poison"].',
  conditionImmune: 'Conditions the character is immune to, such as ["charmed"].',
  darkvision: range("Darkvision"),
  blindsight: range("Blindsight"),
  tremorsense: range("Tremorsense"),
  truesight: range("Truesight"),
  senses:
    'Senses as a list, such as [{"darkvision": 60}]. A sense stated here and as a field of its own counts at the longer range.',
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off a homebrew feat, each described for a table writing one. A
 * field a schema here gains fails typecheck until it is described. `featGrantsSchema`,
 * `rowEntries`, `backgroundFeatOffers` and the features route also read the entry directly;
 * tests record what each reads and fail on a field this list lacks.
 */
export const appliedFeatFieldsSchema = z.object(described);
