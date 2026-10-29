import { z } from "zod";
import { homebrewClassInputSchema, spellcastingAbilitySchema } from "./class.ts";

/**
 * A key several schemas read takes the shape of the last spread, so the homebrew fields come
 * last and keep the shape a homebrew save validates.
 */
const shape = {
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
    'The ability the class casts with, such as "int", which gives the character a spell save DC and spell attack bonus from 1st level. The sheet counts no spell slots for a homebrew class.',
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
 * list and fails typecheck until it is described. A reader that bypasses those schemas
 * escapes the check, so the sheet reads a homebrew class's fields through them.
 */
export const appliedClassFieldsSchema = z.object(described);
