import { ABILITIES } from "@dnd/rules";
import { z } from "zod";

/**
 * The names a `*Proficiencies` list grants outright, lowercased as upstream writes them.
 * Upstream writes a list of alternatives, so only a one-element list grants anything
 * outright. Within it, a key set `true` names one proficiency; `any`, `anyStandard`,
 * `choose` and the other numeric keys offer a pick, and `other` is a language of the
 * player's choosing, so none of them grants a name. A weapon key carries its source, as
 * `battleaxe|phb`, which the name drops. A malformed list grants nothing rather than
 * refusing the row.
 */
const grantedSchema = z
  .array(z.unknown())
  .optional()
  .catch(undefined)
  .transform((alternatives) => {
    const [only, ...rest] = alternatives ?? [];
    if (rest.length > 0 || typeof only !== "object" || only === null) return [];
    return Object.entries(only).flatMap(([key, value]) => {
      const name = key.split("|")[0]?.trim().toLowerCase();
      return value === true && name && name !== "other" ? [name] : [];
    });
  });

/**
 * What a race, subrace or background row grants outright: skills, languages, tools,
 * weapons and armor, each a name for a caller to resolve. A choice it offers is left for
 * the step that asks it.
 */
export const proficiencyGrantsSchema = z
  .looseObject({
    skillProficiencies: grantedSchema,
    languageProficiencies: grantedSchema,
    toolProficiencies: grantedSchema,
    weaponProficiencies: grantedSchema,
    armorProficiencies: grantedSchema,
  })
  .transform((row) => ({
    skills: row.skillProficiencies,
    languages: row.languageProficiencies,
    tools: row.toolProficiencies,
    weapons: row.weaponProficiencies,
    armor: row.armorProficiencies,
  }));

export type ProficiencyGrants = z.output<typeof proficiencyGrantsSchema>;

/**
 * The weapons a class's `startingProficiencies.weapons` grants outright, lowercased: a
 * category such as `simple`, or the weapon an `{@item}` tag names, as `{@item
 * longsword|phb|longswords}` names `longsword`. A line of prose, such as the martial
 * weapons with the Light property that `Monk` (XPHB) grants, names no category or weapon
 * a proficiency holds, and an optional grant such as firearms is the table's call, so
 * neither grants anything.
 */
const startingWeaponsSchema = z
  .array(z.unknown())
  .optional()
  .catch(undefined)
  .transform((weapons) =>
    (weapons ?? []).flatMap((weapon) => {
      if (typeof weapon !== "string") return [];
      const name = /^\{@item ([^|}]+)[^}]*\}$/.exec(weapon)?.[1] ?? weapon;
      return /^[a-z][a-z' -]*$/i.test(name) ? [name.trim().toLowerCase()] : [];
    }),
  );

/**
 * What a class row grants outright to a character who starts in it: its saving throws,
 * and the armor, weapons and tools of `startingProficiencies`. The skills it offers are a
 * choice, left for the step that asks it, so `skills` and `languages` stay empty.
 */
export const classProficiencyGrantsSchema = z
  .looseObject({
    proficiency: z.array(z.enum(ABILITIES)).optional().catch(undefined),
    startingProficiencies: z
      .looseObject({
        armorProficiencies: grantedSchema,
        toolProficiencies: grantedSchema,
        weapons: startingWeaponsSchema,
      })
      .optional()
      .catch(undefined),
  })
  .transform((row) => ({
    savingThrows: row.proficiency ?? [],
    skills: [] as string[],
    languages: [] as string[],
    tools: row.startingProficiencies?.toolProficiencies ?? [],
    weapons: row.startingProficiencies?.weapons ?? [],
    armor: row.startingProficiencies?.armorProficiencies ?? [],
  }));

export type ClassProficiencyGrants = z.output<typeof classProficiencyGrantsSchema>;
