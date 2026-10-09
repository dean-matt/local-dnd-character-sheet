/**
 * The facts a homebrew entry's preview prints ahead of its rules text, each a label and
 * its value, as a catalog detail prints a deity's or a language's. A fact the entry leaves
 * out is left out, never shown empty.
 */
import {
  DAMAGE_TYPES,
  type HomebrewItemInput,
  type HomebrewSpellInput,
  itemHitFacts,
  spellCastingFactsSchema,
} from "@dnd/catalog";
import type { ZodType } from "zod";
import { itemMeta } from "../../lib/itemKind.ts";
import { castingTime, spellComponents, spellDuration, spellRange } from "../../lib/spellFacts.ts";
import { schoolName } from "../../lib/spellSchool.ts";
import { numberAt, textAt } from "./homebrewEntry.ts";

export type Fact = [label: string, value: string];

const stated = (facts: [string, string | undefined][]): Fact[] =>
  facts.filter((fact): fact is Fact => fact[1] !== undefined && fact[1] !== "");

function attunement(reqAttune: HomebrewItemInput["reqAttune"]): string | undefined {
  if (reqAttune === undefined || reqAttune === false) return undefined;
  if (reqAttune === true) return "Required";
  return reqAttune === "optional" ? "Optional" : `Required ${reqAttune}`;
}

function damage(item: HomebrewItemInput): string | undefined {
  const dice = textAt(item, "dmg1");
  if (!dice) return undefined;
  const type = DAMAGE_TYPES[textAt(item, "dmgType")];
  const versatile = textAt(item, "dmg2");
  return [dice, type, versatile && `(${versatile} versatile)`].filter(Boolean).join(" ");
}

export function itemFacts(item: HomebrewItemInput): Fact[] {
  const weight = numberAt(item.weight);
  const value = numberAt(item.value);
  return stated([
    ["Type", itemMeta(itemHitFacts(item))],
    ["Attunement", attunement(item.reqAttune)],
    ["Damage", damage(item)],
    ["Armor class", numberAt(item.ac)?.toString()],
    ["Weight", weight === undefined ? undefined : `${weight} lb.`],
    ["Value", value === undefined ? undefined : `${value / 100} gp`],
  ]);
}

const pick = <T>(schema: ZodType<T>, value: unknown): T | undefined => schema.safeParse(value).data;

/** Each casting fact parses alone, so one malformed field leaves the others standing. */
export function spellFacts(spell: HomebrewSpellInput): Fact[] {
  const { shape } = spellCastingFactsSchema;
  const time = castingTime(pick(shape.time, spell.time));
  const duration = spellDuration(pick(shape.duration, spell.duration));
  const concentration = spell.duration.some((span) => span.concentration === true);
  return stated([
    ["Level", spell.level === 0 ? "Cantrip" : String(spell.level)],
    ["School", schoolName(spell.school)],
    ["Casting time", time && spell.meta?.ritual ? `${time} or ritual` : time],
    ["Range", spellRange(pick(shape.range, spell.range))],
    ["Components", spellComponents(pick(shape.components, spell.components))],
    [
      "Duration",
      duration && concentration
        ? `Concentration, ${duration.charAt(0).toLowerCase()}${duration.slice(1)}`
        : duration,
    ],
  ]);
}
