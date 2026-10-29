import { z } from "zod";
import { entriesSchema } from "./entry.ts";
import { homebrewSkillInputSchema } from "./skill.ts";

/**
 * `rowEntries` reads `entriesHigherLevel` off the entry directly, with no schema to borrow. The
 * homebrew fields come last, so a key both read keeps the shape a homebrew save validates.
 */
const shape = {
  entriesHigherLevel: entriesSchema.optional(),
  ...homebrewSkillInputSchema.omit({ edition: true }).shape,
};

type Shape = typeof shape;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  name: "The skill's name, which the Skills card lists on a character holding it and an item's advantage effect cites. It must differ from every catalog skill and other homebrew skill of its edition, and cannot change while a character or an item holds it.",
  ability:
    'The ability whose modifier the skill adds: "str", "dex", "con", "int", "wis" or "cha". "flat" adds a number each character holding the skill sets on its row instead. Switching between an ability and "flat" resets that number and any override of the modifier on every character holding the skill.',
  entries:
    "The rules text, {@tags} included, printed in the skill's homebrew list entry and the editor's preview.",
  entriesHigherLevel: 'Further rules text, printed after "entries" in the editor\'s preview.',
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off a homebrew skill, each described for a table writing one. A
 * field a schema here gains fails typecheck until it is described. `rowEntries` and
 * `skillFacts` also read the entry directly; a test records what each reads and fails on a
 * field this list lacks.
 */
export const appliedSkillFieldsSchema = z.object(described);
