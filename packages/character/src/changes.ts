/**
 * What a definition write changed, in words a person reads in an undo control, and the
 * paths it touched, which the undo log compares to merge an autosave burst into one entry.
 */
import { ABILITY_LABEL } from "@dnd/rules";
import { z } from "zod";
import type { CharacterDefinition } from "./definition.ts";
import type { Ability, EntryRef } from "./refs.ts";

/**
 * A character's `undo_log` rows as an endpoint lists them, newest first, so the head is
 * what the next undo restores. Each row's snapshot stays on the server.
 */
/** Newest kept per character; the insert that passes it prunes the oldest. */
export const UNDO_LOG_LIMIT = 50;

export const undoLogSchema = z
  .array(
    z.strictObject({
      id: z.int(),
      describedAs: z.string().min(1),
      changedAt: z.iso.datetime(),
    }),
  )
  .max(UNDO_LOG_LIMIT);

/** Exhaustive, so a field added to the definition fails to compile until it has a label. */
export const SECTION_LABEL: Record<keyof CharacterDefinition, string> = {
  name: "Name",
  edition: "Edition",
  levels: "Levels",
  race: "Race",
  subrace: "Subrace",
  size: "Size",
  raceResistance: "Race resistance",
  background: "Background",
  abilityScores: "Ability scores",
  proficiencies: "Proficiencies",
  inventory: "Inventory",
  spells: "Spells",
  feats: "Feats",
  optionalFeatures: "Optional features",
  deity: "Deity",
  alignment: "Alignment",
  money: "Money",
  appearance: "Appearance",
  notes: "Notes",
  houseRules: "House rules",
  departures: "Departures from the rules",
  overrides: "Overrides",
};

/** Sections a person edits one key at a time, so a change names the key. */
const KEYED = new Set<keyof CharacterDefinition>([
  "abilityScores",
  "money",
  "appearance",
  "overrides",
]);

/** The longest value quoted in a description; a longer one reads as "edited". */
const QUOTED_MAX = 40;

interface Change {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) =>
    equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

const words = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const itemName = (ref: EntryRef) => ("name" in ref ? ref.name : "Homebrew item");

/**
 * Reads an override key such as `skills.Stealth|XPHB.modifier` as `Skills Stealth
 * modifier`: an ability names itself, a catalog key its row's name, a camel-cased key its
 * words. The words follow the derived block's keys rather than the sheet's own labels;
 * a label table per field is the way out once an edit view prints one.
 */
function overrideLabel(key: string): string {
  const segments = key.split(".").map((segment) => {
    if (segment in ABILITY_LABEL) return ABILITY_LABEL[segment as Ability];
    if (!segment.includes("|")) return words(segment);
    const [head = "", name = ""] = segment.replace(/#\d+$/, "").split("|");
    if (head === "homebrew") return "homebrew item";
    return head === "catalog" ? name : head;
  });
  return `${capitalize(segments.join(" "))} override`;
}

function keyLabel(section: keyof CharacterDefinition, key: string): string {
  if (section === "abilityScores") return ABILITY_LABEL[key as Ability] ?? key;
  if (section === "overrides") return overrideLabel(key);
  return capitalize(words(key));
}

/** The one entry an inventory edit touched, where the list kept its length and order. */
function inventoryChanges(before: CharacterDefinition, after: CharacterDefinition): Change[] {
  if (before.inventory.length !== after.inventory.length) return [];
  const touched = after.inventory.flatMap((entry, at) =>
    equal(entry, before.inventory[at]) ? [] : [at],
  );
  const [at] = touched;
  const was = at === undefined ? undefined : before.inventory[at];
  const now = at === undefined ? undefined : after.inventory[at];
  if (touched.length !== 1 || !was || !now || !equal(was.ref, now.ref)) return [];
  const fields = new Set([...Object.keys(was), ...Object.keys(now)]);
  return [...fields].flatMap((field) => {
    const from = was[field as keyof typeof was];
    const to = now[field as keyof typeof now];
    if (equal(from, to)) return [];
    return [
      {
        path: `inventory.${at}.${field}`,
        label: `${itemName(now.ref)} ${words(field)}`,
        before: from,
        after: to,
      },
    ];
  });
}

function changes(before: CharacterDefinition, after: CharacterDefinition): Change[] {
  return (Object.keys(SECTION_LABEL) as (keyof CharacterDefinition)[]).flatMap((section) => {
    const from: unknown = before[section];
    const to: unknown = after[section];
    if (equal(from, to)) return [];
    if (KEYED.has(section)) {
      const was = (from ?? {}) as Record<string, unknown>;
      const now = (to ?? {}) as Record<string, unknown>;
      const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
      return [...keys].flatMap((key) =>
        equal(was[key], now[key])
          ? []
          : [
              {
                path: `${section}.${key}`,
                label: keyLabel(section, key),
                before: was[key],
                after: now[key],
              },
            ],
      );
    }
    if (section === "inventory") {
      const entry = inventoryChanges(before, after);
      if (entry.length > 0) return entry;
    }
    return [{ path: section, label: SECTION_LABEL[section], before: from, after: to }];
  });
}

/** An empty string is how a cleared text field stores, so it reads as no value. */
const blank = (value: unknown) => value === undefined || value === "";

const quotable = (value: unknown) =>
  blank(value) ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (typeof value === "string" && value.length <= QUOTED_MAX);

const quote = (value: unknown) =>
  typeof value === "boolean" ? (value ? "yes" : "no") : String(value);

function phrase({ label, before, after }: Change): string {
  if (!quotable(before) || !quotable(after)) return `${label} edited`;
  if (blank(before)) return `${label} set to ${quote(after)}`;
  if (blank(after)) return `${label} cleared`;
  return `${label} ${quote(before)} to ${quote(after)}`;
}

/**
 * `null` where the two definitions hold the same character. Past three changes the
 * description names the first two and counts the rest, so a level-up stays one line.
 */
export function describeChange(
  before: CharacterDefinition,
  after: CharacterDefinition,
): { paths: string[]; describedAs: string } | null {
  const found = changes(before, after);
  if (found.length === 0) return null;
  const phrases = found.map(phrase);
  const describedAs =
    phrases.length > 3
      ? `${phrases.slice(0, 2).join(", ")} and ${phrases.length - 2} more changes`
      : phrases.join(", ");
  return { paths: found.map((change) => change.path), describedAs };
}
