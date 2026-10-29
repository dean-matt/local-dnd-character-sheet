/**
 * One alternative of a feat's `prerequisite`, read part by part as the form shows it and
 * written back in upstream's shape. Each reader returns `undefined` for a part written in a
 * shape the form cannot show, such as a level tied to a class, which the form leaves to the
 * JSON along with every key it has no control for.
 */
import { ABILITIES, type Ability } from "@dnd/character";
import { isRecord } from "../../lib/entryGuards.ts";

/** The parts the form has a control for. */
const PREREQUISITE_PARTS = [
  "level",
  "ability",
  "race",
  "proficiency",
  "feat",
  "spellcasting",
] as const;

/** A score minimum, `null` while its input is empty. */
export type ScoreMinimum = { ability: Ability; minimum: number | null };

const isAbility = (key: string): key is Ability => (ABILITIES as readonly string[]).includes(key);

const listOf = (value: unknown): unknown[] | undefined =>
  value === undefined ? [] : Array.isArray(value) ? value : undefined;

const objectOf = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) && !Array.isArray(value) ? value : undefined;

/** The character level, `null` for none; `undefined` for a level tied to a class. */
export function levelOf(alternative: Record<string, unknown>): number | null | undefined {
  const { level } = alternative;
  if (level === undefined || level === null) return null;
  return typeof level === "number" ? level : undefined;
}

/** Each score minimum, any one of which suffices; `undefined` where one names two scores. */
export function scoresOf(alternative: Record<string, unknown>): ScoreMinimum[] | undefined {
  const scores = listOf(alternative.ability)?.map((score) => {
    const entries = Object.entries(objectOf(score) ?? {});
    const [only] = entries;
    if (entries.length !== 1 || !only || !isAbility(only[0])) return undefined;
    const [ability, minimum] = only;
    return minimum === null || typeof minimum === "number" ? { ability, minimum } : undefined;
  });
  return scores?.every((score) => score !== undefined) ? scores : undefined;
}

/** The races any one of which suffices, lowercased; `undefined` where one names a subrace. */
export function racesOf(alternative: Record<string, unknown>): string[] | undefined {
  const races = listOf(alternative.race)?.map((race) => {
    const { name, ...rest } = objectOf(race) ?? {};
    return typeof name === "string" && Object.keys(rest).length === 0
      ? name.toLowerCase()
      : undefined;
  });
  return races?.every((race) => race !== undefined) ? races : undefined;
}

/** Each armor or weapon proficiency as `armor:heavy` or `weapon:martial`, any one sufficing. */
export function proficienciesOf(alternative: Record<string, unknown>): string[] | undefined {
  const held = listOf(alternative.proficiency)?.map((proficiency) => {
    const entries = Object.entries(objectOf(proficiency) ?? {});
    const [only] = entries;
    return entries.length === 1 &&
      only &&
      (only[0] === "armor" || only[0] === "weapon") &&
      typeof only[1] === "string"
      ? `${only[0]}:${only[1].toLowerCase()}`
      : undefined;
  });
  return held?.every((each) => each !== undefined) ? held : undefined;
}

/** `armor:heavy` as upstream writes it. */
export function proficiencyEntry(value: string): Record<string, string> {
  const [kind = "", name = ""] = value.split(":");
  return { [kind]: name };
}

/** The feats any one of which suffices, keyed `name|source` lowercased. */
export function featsOf(alternative: Record<string, unknown>): string[] | undefined {
  const feats = listOf(alternative.feat);
  return feats?.every((feat) => typeof feat === "string")
    ? feats.map((feat) => (feat as string).toLowerCase())
    : undefined;
}

/** Whether the alternative needs the ability to cast a spell; `undefined` for anything but a flag. */
export function spellcastingOf(alternative: Record<string, unknown>): boolean | undefined {
  const { spellcasting } = alternative;
  return spellcasting === undefined || typeof spellcasting === "boolean"
    ? spellcasting === true
    : undefined;
}

/** Whether the alternative states anything the form shows no control for. */
export function hasUnshownParts(alternative: Record<string, unknown>): boolean {
  return (
    Object.keys(alternative).some(
      (key) => !(PREREQUISITE_PARTS as readonly string[]).includes(key),
    ) ||
    [levelOf, scoresOf, racesOf, proficienciesOf, featsOf, spellcastingOf].some(
      (read) => read(alternative) === undefined,
    )
  );
}

/** What is wrong with the alternative as the form shows it, naming it by its position. */
export function prerequisiteProblem(alternative: unknown, position: number): string | undefined {
  const named = `Prerequisite ${position}`;
  const parts = objectOf(alternative);
  if (!parts) return undefined;
  if (Object.keys(parts).length === 0) return `${named}: set at least one requirement`;
  const level = levelOf(parts);
  if (typeof level === "number" && !(Number.isInteger(level) && level >= 1 && level <= 20)) {
    return `${named}: a character level from 1 to 20`;
  }
  const scores = scoresOf(parts) ?? [];
  if (
    scores.some(
      ({ minimum }) =>
        minimum === null || !(Number.isInteger(minimum) && minimum >= 1 && minimum <= 30),
    )
  ) {
    return `${named}: a score minimum from 1 to 30`;
  }
  return undefined;
}
