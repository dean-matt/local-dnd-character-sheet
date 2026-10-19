/**
 * What a homebrew race, class, background or feat row's chips and preview name, read off
 * its 5etools-shaped entry by the same schemas the sheet reads it with. A fact the entry
 * leaves out is left out.
 */
import {
  abilityIncreasesSchema,
  classProficiencyGrantsSchema,
  type FeatPrerequisite,
  featTermsSchema,
  proficiencyGrantsSchema,
  raceTraitsSchema,
} from "@dnd/catalog";
import { capitalize } from "../../lib/capitalize.ts";
import { titleCase } from "../../lib/proficiencyGrants.ts";
import type { Fact } from "./homebrewFacts.ts";

type Json = Record<string, unknown>;

const stated = (facts: [string, string][]): Fact[] => facts.filter(([, value]) => value !== "");

const abbreviated = (ability: string) => ability.toUpperCase();

/** `{ dex: 2, cha: 1 }` as `+2 DEX +1 CHA`, the increases a race fixes; a choice is left to its rules text. */
function increases(json: Json): string {
  const [first] = abilityIncreasesSchema.parse(json);
  return Object.entries(first?.fixed ?? {})
    .map(([ability, amount]) => `${amount < 0 ? "" : "+"}${amount} ${abbreviated(ability)}`)
    .join(" ");
}

export function raceFacts(json: Json): Fact[] {
  const traits = raceTraitsSchema.safeParse(json).data;
  return stated([
    ["Size", traits?.sizes.map(capitalize).join(" or ") ?? ""],
    ["Speed", traits ? `${traits.speed.walk} ft.` : ""],
    ["Ability Scores", increases(json)],
  ]);
}

/** Upstream's `primaryAbility`: alternatives, each naming the abilities it needs together. */
function primaryAbility(json: Json): string {
  const { primaryAbility } = json;
  if (!Array.isArray(primaryAbility)) return "";
  return primaryAbility
    .map((alternative: Json) =>
      Object.keys(alternative ?? {})
        .filter((ability) => alternative[ability] === true)
        .map(abbreviated)
        .join(" and "),
    )
    .filter(Boolean)
    .join(" or ");
}

export function classFacts(json: Json): Fact[] {
  const { savingThrows } = classProficiencyGrantsSchema.parse(json);
  const hd = json.hd as { faces?: unknown } | undefined;
  return stated([
    ["Hit Die", typeof hd?.faces === "number" ? `d${hd.faces}` : ""],
    ["Primary Ability", primaryAbility(json)],
    ["Saving Throws", savingThrows.map(abbreviated).join("/")],
  ]);
}

export function backgroundFacts(json: Json): Fact[] {
  return stated([["Skills", proficiencyGrantsSchema.parse(json).skills.map(titleCase).join(", ")]]);
}

/** One alternative of a feat's prerequisites, every part of which it needs. */
function prerequisiteText(prerequisite: FeatPrerequisite): string {
  const { level, className, scores, races, proficiencies, feats, features, spell } = prerequisite;
  const anyOf = (names: string[]) => names.join(" or ");
  return [
    level === undefined ? "" : `${className ? `${className} ` : ""}Level ${level}`,
    anyOf(
      scores.map((minimums) =>
        Object.entries(minimums)
          .map(([ability, minimum]) => `${abbreviated(ability)} ${minimum}`)
          .join(" and "),
      ),
    ),
    anyOf(races.map(({ name, subrace }) => titleCase(subrace ? `${name} (${subrace})` : name))),
    anyOf(
      proficiencies.map(
        ({ armor, weapon }) =>
          [armor && `${titleCase(armor)} armor`, weapon && `${titleCase(weapon)} weapon`]
            .filter(Boolean)
            .join(" and ") + " proficiency",
      ),
    ),
    anyOf(feats.map((feat) => titleCase(feat.split("|")[0] ?? feat))),
    ...features.map(anyOf),
    spell ? "Spellcasting" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function featFacts(json: Json): Fact[] {
  const alternatives = featTermsSchema.parse(json).prerequisites.map(prerequisiteText);
  // An alternative naming nothing the schema reads, such as a background, reads as met.
  if (alternatives.includes("")) return [];
  return stated([["Prerequisite", alternatives.join("; or ")]]);
}
