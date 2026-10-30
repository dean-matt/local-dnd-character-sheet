/**
 * A homebrew class's fields read as the form shows them and written back in upstream's shape.
 * A reader returns `undefined` for a shape the form cannot show, which the form leaves to the
 * JSON; a writer keeps every key it has no control for.
 */
import { ABILITIES } from "@dnd/character";
import { isRecord } from "../../lib/entryGuards.ts";
import type { GrantSpec } from "./featGrantShapes.ts";
import type { HomebrewEntry } from "./homebrewDraft.ts";

type Json = Record<string, unknown>;
type Ability = (typeof ABILITIES)[number];

const objectAt = (value: unknown): Json | undefined =>
  isRecord(value) && !Array.isArray(value) ? value : undefined;

/** `container` with `key` set to `value`, or removed where `value` is `undefined`. */
function withKey(container: Json, key: string, value: unknown): Json {
  const { [key]: _old, ...rest } = container;
  return value === undefined ? rest : { ...rest, [key]: value };
}

/** `container` as an object, or `undefined` for a nonempty one, so an emptied field leaves the entry. */
const orNothing = (container: Json): Json | undefined =>
  Object.keys(container).length > 0 ? container : undefined;

export type PrimaryAbility = { abilities: Ability[]; all: boolean };

/**
 * The primary ability as alternatives: each alternative names the abilities it needs
 * together, so one alternative of several abilities means all of them and an alternative
 * apiece means any one. Another shape, such as a score in place of `true`, reads `undefined`.
 */
export function readPrimaryAbility(value: unknown): PrimaryAbility | undefined {
  if (value === undefined) return { abilities: [], all: false };
  if (!Array.isArray(value)) return undefined;
  const named: string[][] = [];
  for (const alternative of value) {
    const flags = objectAt(alternative);
    if (!flags || !Object.values(flags).every((flag) => flag === true)) return undefined;
    named.push(Object.keys(flags));
  }
  const abilities = named.flat();
  if (!abilities.every(isAbility)) return undefined;
  if (named.length === 1 && abilities.length > 1) return { abilities, all: true };
  return named.every((names) => names.length === 1) ? { abilities, all: false } : undefined;
}

const isAbility = (name: string): name is Ability =>
  (ABILITIES as readonly string[]).includes(name);

/** `abilities` as the alternatives `all` asks for; `undefined` for none. */
export function writePrimaryAbility({ abilities, all }: PrimaryAbility): Json[] | undefined {
  const ordered = ABILITIES.filter((ability) => abilities.includes(ability));
  if (ordered.length === 0) return undefined;
  return all
    ? [Object.fromEntries(ordered.map((ability) => [ability, true]))]
    : ordered.map((ability) => ({ [ability]: true }));
}

/** A class offers its skills as a choice; naming them outright is not a class's shape. */
export const CLASS_SKILL_SPEC: GrantSpec = { anyKey: "any" };

export type ProficiencyList = "armor" | "weapons" | "tools";

/** A name `grantedSchema` and `startingWeaponsSchema` read as a proficiency; a tag or prose is not one. */
const PLAIN = /^[a-z][a-z' -]*$/;

/** The structured list upstream writes beside a prose list, which the sheet grants from. */
const STRUCTURED: Partial<Record<ProficiencyList, string>> = {
  armor: "armorProficiencies",
  tools: "toolProficiencies",
};

/** The names a structured list holds where no prose one is stated; `undefined` where the form cannot show it. */
function readStructured(container: Json, list: ProficiencyList): string[] | undefined {
  if (list === "weapons") return container.weaponProficiencies === undefined ? [] : undefined;
  const structured = STRUCTURED[list];
  const only = structured ? container[structured] : undefined;
  if (only === undefined) return [];
  if (!Array.isArray(only) || only.length !== 1) return undefined;
  const alternative = objectAt(only[0]);
  return alternative && Object.values(alternative).every((flag) => flag === true)
    ? Object.keys(alternative)
    : undefined;
}

/** The names a prose list holds, lowercased; `undefined` where it holds anything but strings. */
export function readNames(container: Json, list: ProficiencyList): string[] | undefined {
  const prose = container[list];
  if (prose === undefined) return readStructured(container, list);
  if (!Array.isArray(prose) || !prose.every((name) => typeof name === "string")) return undefined;
  return prose.map((name: string) => name.toLowerCase());
}

/**
 * `container` with the list set to `names`, and the structured list beside it, where
 * upstream writes one, set to the plain names among them.
 */
export function writeNames(container: Json, list: ProficiencyList, names: string[]): Json {
  const stated = Array.isArray(container[list]) ? (container[list] as unknown[]) : [];
  const original = (name: string) =>
    stated.find(
      (line): line is string => typeof line === "string" && line.toLowerCase() === name,
    ) ?? name;
  const kept = names.map(original);
  const withProse = withKey(container, list, kept.length > 0 ? kept : undefined);
  const structured = STRUCTURED[list];
  if (!structured) return withProse;
  const plain = names.filter((name) => PLAIN.test(name));
  return withKey(
    withProse,
    structured,
    plain.length > 0 ? [Object.fromEntries(plain.map((name) => [name, true]))] : undefined,
  );
}

/** The proficiencies a class grants, in `startingProficiencies` or `multiclassing.proficienciesGained`. */
export function proficienciesIn(entry: HomebrewEntry, gained: boolean): Json | undefined {
  if (!gained) return objectAt(entry.startingProficiencies);
  return objectAt(objectAt(entry.multiclassing)?.proficienciesGained);
}

/** `entry` with those proficiencies replaced; an emptied one leaves the entry. */
export function withProficiencies(
  entry: HomebrewEntry,
  gained: boolean,
  next: Json,
): HomebrewEntry {
  if (!gained) return withKey(entry, "startingProficiencies", orNothing(next));
  return withMulticlassing(entry, "proficienciesGained", orNothing(next));
}

/** `entry` with `key` of its `multiclassing` set to `value`; the field leaves once it holds nothing. */
export function withMulticlassing(
  entry: HomebrewEntry,
  key: string,
  value: unknown,
): HomebrewEntry {
  const multiclassing = objectAt(entry.multiclassing) ?? {};
  return withKey(entry, "multiclassing", orNothing(withKey(multiclassing, key, value)));
}

export type Minimums = Partial<Record<Ability, number | null>>;

/**
 * The scores a class needs to multiclass, one minimum per ability that all must meet.
 * Alternatives under `or` read `undefined`, which the form leaves to the JSON.
 */
export function readRequirements(multiclassing: unknown): Minimums | undefined {
  const requirements = objectAt(objectAt(multiclassing)?.requirements);
  if (!requirements) return {};
  const minimums: Minimums = {};
  for (const [key, score] of Object.entries(requirements)) {
    if (!isAbility(key) || typeof score !== "number") return undefined;
    minimums[key] = score;
  }
  return minimums;
}

/** `minimums` as `requirements`, in ability order; `undefined` where none is set. */
export function writeRequirements(minimums: Minimums): Json | undefined {
  const set = ABILITIES.flatMap((ability) => {
    const score = minimums[ability];
    return score === undefined || score === null ? [] : [[ability, score] as const];
  });
  return set.length > 0 ? Object.fromEntries(set) : undefined;
}

/** What is wrong with the minimums, naming the ability; nothing for a shape the form leaves to the JSON. */
export function requirementProblem(multiclassing: unknown): string | undefined {
  const requirements = objectAt(objectAt(multiclassing)?.requirements);
  for (const [key, score] of Object.entries(requirements ?? {})) {
    if (
      isAbility(key) &&
      typeof score === "number" &&
      !(Number.isInteger(score) && score >= 1 && score <= 30)
    ) {
      return `${key.toUpperCase()} minimum: a whole number from 1 to 30`;
    }
  }
  return undefined;
}

export type Equipment = { lines: string[]; gold: string; withBackground: boolean };

/**
 * The starting equipment as the choices a class prints, one per line, the gold taken instead,
 * and whether it comes on top of the background's. The `one` edition's `entries` and
 * `defaultData` stay as written.
 */
export function readEquipment(value: unknown): Equipment | undefined {
  if (value === undefined) return { lines: [], gold: "", withBackground: false };
  const equipment = objectAt(value);
  if (!equipment) return undefined;
  const { default: lines = [], goldAlternative = "", additionalFromBackground } = equipment;
  if (!Array.isArray(lines) || !lines.every((line) => typeof line === "string")) return undefined;
  if (typeof goldAlternative !== "string") return undefined;
  return { lines, gold: goldAlternative, withBackground: additionalFromBackground === true };
}

/** `value` with the equipment's choices, gold and flag replaced; an emptied field leaves the entry. */
export function writeEquipment(value: unknown, { lines, gold, withBackground }: Equipment) {
  const equipment = objectAt(value) ?? {};
  return orNothing(
    withKey(
      withKey(
        withKey(equipment, "default", lines.length > 0 ? lines : undefined),
        "goldAlternative",
        gold === "" ? undefined : gold,
      ),
      "additionalFromBackground",
      withBackground ? true : undefined,
    ),
  );
}
