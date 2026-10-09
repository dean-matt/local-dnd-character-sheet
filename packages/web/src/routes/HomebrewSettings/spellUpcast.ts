/** A homebrew spell's upcast text: the one named section upstream writes it as. */
import type { CharacterRecord } from "@dnd/character";
import { isRecord } from "../../lib/entryGuards.ts";
import type { HomebrewEntry } from "./homebrewDraft.ts";
import { paragraphsOf } from "./homebrewEntry.ts";

type Edition = CharacterRecord["edition"];

/**
 * The heading upstream gives the section. A 2024 cantrip's is `Cantrip Upgrade`; a 2014
 * cantrip carries none upstream, so it takes the leveled spell's.
 */
export function upcastName(edition: Edition, level: unknown): string {
  if (edition === "classic") return "At Higher Levels";
  return level === 0 ? "Cantrip Upgrade" : "Using a Higher-Level Spell Slot";
}

const UPSTREAM_NAMES = ["At Higher Levels", "Cantrip Upgrade", "Using a Higher-Level Spell Slot"];

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
export function upcastSection(current: unknown, paragraphs: string[], name: string) {
  const kept = isRecord(current) ? current : { type: "entries" };
  return { ...kept, name: typeof kept.name === "string" ? kept.name : name, entries: paragraphs };
}

/**
 * `entry` with its upcast section renamed for `edition` and its level where it carries
 * another of upstream's headings; the same `entry` where nothing changes. A heading of the
 * user's own is kept.
 */
export function withUpcastNameFor(entry: HomebrewEntry, edition: Edition): HomebrewEntry {
  const sections = entry.entriesHigherLevel;
  if (!Array.isArray(sections) || sections.length !== 1 || !isRecord(sections[0])) return entry;
  const { name } = sections[0];
  const wanted = upcastName(edition, entry.level);
  if (typeof name !== "string" || name === wanted || !UPSTREAM_NAMES.includes(name)) return entry;
  return { ...entry, entriesHigherLevel: [{ ...sections[0], name: wanted }] };
}
