import { z } from "zod";
import { abilityIncreasesSchema } from "./ability-increases.ts";
import { defenseTraitSchema } from "./defense.ts";
import { homebrewRaceInputSchema, raceTraitsSchema } from "./race.ts";
import { senseGrantsSchema } from "./sense.ts";

/**
 * `type` is left out because it only fences a potion's defenses, and no race is one. A key
 * several schemas read takes the shape of the last spread, so the homebrew fields come last
 * and keep the shape a homebrew save validates.
 */
const shape = {
  ability: abilityIncreasesSchema.in.shape.ability,
  ...raceTraitsSchema.in.shape,
  ...defenseTraitSchema.in.omit({ type: true }).shape,
  ...senseGrantsSchema.in.shape,
  ...homebrewRaceInputSchema.omit({ edition: true }).shape,
};

type Shape = typeof shape;

const range = (sense: string) => `${sense} range in feet, such as 60.`;

const DESCRIPTIONS: { [K in keyof Shape]: string } = {
  name: "The race's name, which heads its traits among the character's features.",
  entries:
    'The rules text, {@tags} included. Each named entry, such as {"type": "entries", "name": "Darkvision", "entries": ["You see in dim light within 60 feet."]}, lists as a race trait among the character\'s features.',
  size: 'Size codes, such as ["M"]: "T" tiny, "S" small, "M" medium, "L" large, "H" huge, "G" gargantuan, or "V" small or medium. Sets the size carrying capacity reads; of several, the sheet takes the largest.',
  speed:
    'Feet of walking speed, such as 30, or a speed per mode, such as {"walk": 30, "fly": 30, "swim": true}, where walk is required and true matches it. The other modes are burrow, climb, fly and swim.',
  resist:
    'Damage types resisted, such as ["fire"]. {"choose": {"from": ["cold", "fire"]}} in the list grants nothing until the character picks, which the sheet offers on the Race card and in creation.',
  ability:
    'Ability score increases, as alternatives, such as [{"str": 2, "cha": 1}] or [{"choose": {"from": ["str", "dex", "con"], "count": 2}}]. The sheet asks where a choice goes, on the Race card and in creation, and the increases it places raise the character\'s scores.',
  immune: 'Damage types the character is immune to, such as ["poison"].',
  conditionImmune: 'Conditions the character is immune to, such as ["charmed"].',
  vulnerable: 'Damage types the character is vulnerable to, such as ["thunder"].',
  darkvision: range("Darkvision"),
  blindsight: range("Blindsight"),
  tremorsense: range("Tremorsense"),
  truesight: range("Truesight"),
  senses:
    'Senses as a list, such as [{"darkvision": 120}]. A sense stated here and as a field of its own counts at the longer range.',
};

const described = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [
    key,
    schema.describe(DESCRIPTIONS[key as keyof Shape]),
  ]),
) as Shape;

/**
 * Every field the sheet reads off a race entry, each described for a table writing a
 * homebrew race. Composed from the schemas that read each field, so a field one of them
 * gains reaches this list and fails typecheck until it is described.
 */
export const appliedRaceFieldsSchema = z.object(described);
