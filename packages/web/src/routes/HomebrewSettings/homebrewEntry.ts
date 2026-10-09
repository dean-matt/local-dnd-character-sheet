/**
 * Reading and writing one field of a homebrew entry from a form control. Each writer returns
 * a new entry and leaves every other field as it found it, so a field no control shows
 * survives an edit through the form.
 */
import { type Entries, entriesSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import type { ReactNode } from "react";
import { isRecord } from "../../lib/entryGuards.ts";
import type { HomebrewEntry } from "./homebrewDraft.ts";

/** What `ItemForm` and `SpellForm` take: the entry, a way to replace it, and each field's problem. */
export interface HomebrewFormProps {
  entry: HomebrewEntry;
  edition: CharacterRecord["edition"];
  onChange: (next: HomebrewEntry) => void;
  /** The problem to show beside the control for the top-level field `key`, if it has one. */
  errorFor: (key: string) => ReactNode;
}

/** `entry` with `key` set to `value`, or removed where `value` is `undefined`. */
export function withField(entry: HomebrewEntry, key: string, value: unknown): HomebrewEntry {
  const { [key]: _old, ...rest } = entry;
  return value === undefined ? rest : { ...rest, [key]: value };
}

/** `entry`'s `key` where it is an object, else an empty one to spread a change into. */
export const recordAt = (entry: HomebrewEntry, key: string): Record<string, unknown> => {
  const value = entry[key];
  return isRecord(value) && !Array.isArray(value) ? value : {};
};

/** `entry`'s `key` where it is a list, else an empty one. */
export const listAt = (entry: HomebrewEntry, key: string): unknown[] => {
  const value = entry[key];
  return Array.isArray(value) ? value : [];
};

export const textAt = (entry: HomebrewEntry, key: string): string =>
  typeof entry[key] === "string" ? (entry[key] as string) : "";

export const numberAt = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** A number input's value: `undefined` for an empty or unfinished one. */
export const typedNumber = (text: string): number | undefined =>
  text.trim() === "" || !Number.isFinite(Number(text)) ? undefined : Number(text);

/** A number input's whole number, its fraction dropped, for a field upstream holds as an integer. */
export const typedInteger = (text: string): number | undefined => {
  const value = typedNumber(text);
  return value === undefined ? undefined : Math.trunc(value);
};

/** `+1` as upstream writes a bonus, from the number `1`. */
export const signed = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : `${value < 0 ? "-" : "+"}${Math.abs(value)}`;

/** The number a `+1` bonus holds. */
export const unsigned = (value: unknown): number | undefined =>
  typeof value === "string" && /^[+-]\d+$/.test(value) ? Number(value) : undefined;

/**
 * Rules text as paragraphs, a blank line between each, where every entry is a string;
 * `undefined` where one is a list, a table or a named section, which plain text cannot hold.
 */
export function paragraphsOf(entries: unknown): string | undefined {
  if (entries === undefined) return "";
  if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) {
    return undefined;
  }
  return entries.join("\n\n");
}

/** Each paragraph of `text`, or `undefined` for text holding none. */
export function entriesOf(text: string): string[] | undefined {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : undefined;
}

/**
 * The strings among `list`, lowercased for a comparison, as a damage type or condition list
 * holds them. Anything else in it, such as a `{choose}` a pasted entry carries, is kept by
 * `withChosen`.
 */
export const chosenIn = (list: unknown[]): string[] =>
  list.flatMap((value) => (typeof value === "string" ? [value.toLowerCase()] : []));

/** `list` with its strings replaced by `chosen`; `undefined` where nothing is left. */
export function withChosen(list: unknown[], chosen: string[]): unknown[] | undefined {
  const next = [...list.filter((value) => typeof value !== "string"), ...chosen];
  return next.length > 0 ? next : undefined;
}

/** `value` where it is rules text a preview can render. */
export const previewOf = (value: unknown): Entries | undefined =>
  entriesSchema.safeParse(value).data;
