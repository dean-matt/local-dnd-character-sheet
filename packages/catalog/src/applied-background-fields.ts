import { z } from "zod";
import { homebrewBackgroundInputSchema } from "./character-options.ts";
import { entriesSchema } from "./entry.ts";
import { proficiencyGrantsSchema } from "./proficiency-grants.ts";

/**
 * `entriesHigherLevel` is read off the entry directly, with no schema to borrow. The homebrew
 * fields come last, so a key both read keeps the shape a homebrew save validates.
 */
const shape = {
  entriesHigherLevel: entriesSchema.optional(),
  skillProficiencies: proficiencyGrantsSchema.in.shape.skillProficiencies,
  ...homebrewBackgroundInputSchema.omit({ edition: true }).shape,
};

type Shape = typeof shape;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  name: "The background's name, as the sheet prints it for the character's background.",
  entries:
    'The rules text, {@tags} included, printed in the background\'s detail. Each named entry with "data": {"isFeature": true} lists among the character\'s background features, "Feature: " dropped from its name, so "Feature: Open Road" lists as Open Road.',
  entriesHigherLevel: 'Further rules text, printed after "entries" in the background\'s detail.',
  skillProficiencies:
    'Skills, such as [{"insight": true, "survival": true}], printed in the background\'s homebrew list entry. The sheet grants none of them to a character with a homebrew background.',
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off a homebrew background, each described for a table writing
 * one. A field a schema here gains fails typecheck until it is described. `rowEntries`,
 * `backgroundFacts` and the features route also read the entry directly; a test records what
 * the first two read and fails on a field this list lacks.
 */
export const appliedBackgroundFieldsSchema = z.object(described);
