/** A homebrew spell's upcast text: the one named section upstream writes it as. */
import type { CharacterRecord } from "@dnd/character";
import { isRecord } from "../../lib/entryGuards.ts";
import type { HomebrewEntry } from "./homebrewDraft.ts";
import { paragraphsOf } from "./homebrewEntry.ts";

type Edition = CharacterRecord["edition"];

/** The section heading upstream gives upcast text in each edition. */
const UPCAST_NAME: Record<Edition, string> = {
  classic: "At Higher Levels",
  one: "Using a Higher-Level Spell Slot",
};

/**
 * The upcast text as paragraphs, where it is one section of plain paragraphs; `undefined`
 * for anything else, which the form leaves to the JSON view.
 */
export function upcastText(value: unknown): string | undefined {
  if (value === undefined) return "";
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) return undefined;
  return paragraphsOf(value[0].entries);
}

/** The upcast section holding `paragraphs`, keeping `current`'s name and any other field. */
export function upcastSection(current: unknown, paragraphs: string[], edition: Edition) {
  const kept = isRecord(current) ? current : { type: "entries" };
  return {
    ...kept,
    name: typeof kept.name === "string" ? kept.name : UPCAST_NAME[edition],
    entries: paragraphs,
  };
}

/**
 * `entry` with its upcast section renamed for `edition` where it carries the other
 * edition's heading; the same `entry` where nothing changes. A heading of the user's own
 * is kept.
 */
export function withUpcastNameFor(entry: HomebrewEntry, edition: Edition): HomebrewEntry {
  const sections = entry.entriesHigherLevel;
  if (!Array.isArray(sections) || sections.length !== 1 || !isRecord(sections[0])) return entry;
  const { name } = sections[0];
  const other = Object.values(UPCAST_NAME).filter((each) => each !== UPCAST_NAME[edition]);
  if (typeof name !== "string" || !other.includes(name)) return entry;
  return { ...entry, entriesHigherLevel: [{ ...sections[0], name: UPCAST_NAME[edition] }] };
}
