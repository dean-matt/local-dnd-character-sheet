/**
 * The facts a homebrew entry's preview prints ahead of its rules text, each a label and
 * its value, as a catalog detail prints a deity's or a language's. A fact the entry leaves
 * out is left out, never shown empty.
 */
import {
  armorTraitSchema,
  type HomebrewItemInput,
  type HomebrewSpellInput,
  itemHitFacts,
  spellCastingFacts,
  weaponTraitSchema,
} from "@dnd/catalog";
import type { z } from "zod";
import { copperLabel } from "../../lib/coins.ts";
import { itemMeta } from "../../lib/itemKind.ts";
import { castingTime, spellComponents, spellDuration, spellRange } from "../../lib/spellFacts.ts";
import { schoolName } from "../../lib/spellSchool.ts";
import { numberAt, signed } from "./homebrewEntry.ts";

export type Fact = [label: string, value: string];

const stated = (facts: [string, string | undefined][]): Fact[] =>
  facts.filter((fact): fact is Fact => fact[1] !== undefined && fact[1] !== "");

function attunement(reqAttune: HomebrewItemInput["reqAttune"]): string | undefined {
  if (reqAttune === undefined || reqAttune === false) return undefined;
  if (reqAttune === true) return "Required";
  return reqAttune === "optional" ? "Optional" : `Required ${reqAttune}`;
}

const withBonus = (dice: string, bonus: number) =>
  bonus === 0 ? dice : `${dice} ${bonus < 0 ? "-" : "+"} ${Math.abs(bonus)}`;

/** A weapon's damage as its attack deals it, a magic bonus added to each die. */
function damage(weapon: z.output<typeof weaponTraitSchema>): string | undefined {
  if (!weapon?.damage) return undefined;
  const { dice, type } = weapon.damage;
  const versatile = weapon.versatileDamage;
  return [
    withBonus(dice, weapon.bonus.damage),
    type,
    versatile && `(${withBonus(versatile, weapon.bonus.damage)} versatile)`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function itemFacts(item: HomebrewItemInput): Fact[] {
  const weight = numberAt(item.weight);
  const value = numberAt(item.value);
  const weapon = weaponTraitSchema.safeParse(item).data;
  const attack = weapon?.bonus.attack ?? 0;
  return stated([
    ["Type", itemMeta(itemHitFacts(item))],
    ["Attunement", attunement(item.reqAttune)],
    ["Attack bonus", attack === 0 ? undefined : signed(attack)],
    ["Damage", damage(weapon)],
    ["Armor class", armorTraitSchema.safeParse(item).data?.armorClass.toString()],
    ["Weight", weight === undefined ? undefined : `${weight} lb.`],
    ["Value", value === undefined ? undefined : copperLabel(value)],
  ]);
}

export function spellFacts(spell: HomebrewSpellInput): Fact[] {
  const facts = spellCastingFacts(spell);
  const time = castingTime(facts.time);
  const duration = spellDuration(facts.duration);
  const concentration = spell.duration.some((span) => span.concentration === true);
  return stated([
    ["Level", spell.level === 0 ? "Cantrip" : String(spell.level)],
    ["School", schoolName(spell.school)],
    ["Casting time", time && spell.meta?.ritual ? `${time} or ritual` : time],
    ["Range", spellRange(facts.range)],
    ["Components", spellComponents(facts.components)],
    [
      "Duration",
      duration && concentration
        ? `Concentration, ${duration.charAt(0).toLowerCase()}${duration.slice(1)}`
        : duration,
    ],
  ]);
}
