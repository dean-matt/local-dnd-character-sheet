import { z } from "zod";
import { spellCastingFactsSchema, spellEffectSchema, spellEntrySchema } from "./spell.ts";

/**
 * `duration` is read twice, for its concentration and as a casting fact. A key several
 * schemas read takes the shape of the last spread, so the entry's fields come last and keep
 * the shape a homebrew save validates.
 */
const shape = {
  ...spellCastingFactsSchema.shape,
  ...spellEffectSchema.shape,
  ...spellEntrySchema.omit({ source: true }).shape,
};

type Shape = typeof shape;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  name: "The spell's name.",
  level:
    "0 for a cantrip, or 1 to 9: the slot it takes, and the level a spell list files it under.",
  school:
    'The school code: "A" abjuration, "C" conjuration, "D" divination, "E" enchantment, "V" evocation, "I" illusion, "N" necromancy or "T" transmutation.',
  time: 'Casting time, such as [{"number": 1, "unit": "action"}], or [{"number": 1, "unit": "reaction", "condition": "which you take when you are hit"}] with its trigger.',
  range:
    'Such as {"type": "point", "distance": {"type": "feet", "amount": 150}}, {"type": "point", "distance": {"type": "self"}}, or {"type": "cone", "distance": {"type": "feet", "amount": 15}} for an area from the caster.',
  components:
    'Such as {"v": true, "s": true, "m": "a ball of bat guano"}. "m" also takes {"text": "a diamond worth 300+ GP"}.',
  duration:
    'Such as [{"type": "instant"}], or [{"type": "timed", "duration": {"type": "minute", "amount": 1}, "concentration": true}]. "concentration": true marks the spell as needing concentration.',
  meta: '{"ritual": true} where the spell can be cast as a ritual.',
  damageInflict: 'Damage types the spell deals, such as ["fire"].',
  entries:
    "The rules text, {@tags} included. The first {@damage 8d6} roll it prints is the damage the sheet shows for the spell.",
  entriesHigherLevel:
    'What a higher-level slot or a cantrip\'s upgrade adds, such as [{"type": "entries", "name": "Using a Higher-Level Spell Slot", "entries": ["The damage increases by 1d6 for each spell slot level above 3."]}]. Prints after the rules text.',
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off a spell entry, each described for a table writing a
 * homebrew spell. Composed from the schemas that read each field, so a field one of them
 * gains reaches this list and fails typecheck until it is described. A reader that bypasses
 * those schemas escapes the check, so the sheet reads a spell's fields through them.
 */
export const appliedSpellFieldsSchema = z.object(described);
