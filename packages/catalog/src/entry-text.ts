import type { Entries } from "./entry.ts";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A bold-labelled line, or none where the value is absent. */
export const line = (label: string, value: string | undefined): Entries =>
  value ? [`{@b ${label}} ${value}`] : [];

export const capitalized = (value: string | undefined) =>
  value && value.charAt(0).toUpperCase() + value.slice(1);

/** A skill as printed: each word capitalized but `of`, as in `Sleight of Hand`. */
export const titled = (name: string) =>
  name.replace(/\b(?!of\b)[a-z]/g, (letter) => letter.toUpperCase());

const ORDINALS = ["", "1st", "2nd", "3rd"];

export const ordinal = (level: string) => ORDINALS[Number(level)] ?? `${level}th`;
