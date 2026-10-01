/** Guards over an `entries` node, whose fields upstream leaves untyped. */
import type { Entries } from "@dnd/catalog";

export type EntryNode = Exclude<Entries[number], string>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isEntries(value: unknown): value is Entries {
  return Array.isArray(value);
}
