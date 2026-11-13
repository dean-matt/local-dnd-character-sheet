/**
 * What a definition or state write changed, in words a person reads in an undo control,
 * and the paths a definition write touched, which the undo log compares to merge an
 * autosave burst into one entry.
 */
import { ABILITY_LABEL } from "@dnd/rules";
import { z } from "zod";
import { resourceLabel } from "./classResources.ts";
import type { CharacterDefinition } from "./definition.ts";
import { classResourceKey, itemKey } from "./keys.ts";
import type { Ability, EntryRef } from "./refs.ts";
import type { CharacterState } from "./state.ts";

/** Newest kept per character; the insert that passes it prunes the oldest. */
export const UNDO_LOG_LIMIT = 50;

/**
 * A character's `undo_log` rows as an endpoint lists them, newest first, so the head is
 * what the next undo restores. Each row's snapshot stays on the server; `changes` names
 * every change undoing the row reverses, where `describedAs` stops at three.
 */
export const undoLogSchema = z
  .array(
    z.strictObject({
      id: z.int(),
      describedAs: z.string().min(1),
      changes: z.array(z.string().min(1)).min(1),
      changedAt: z.iso.datetime(),
    }),
  )
  .max(UNDO_LOG_LIMIT);

/** Exhaustive, so a field added to the definition fails to compile until it has a label. */
export const SECTION_LABEL: Record<keyof CharacterDefinition, string> = {
  name: "Name",
  edition: "Edition",
  levels: "Levels",
  leveling: "Leveling",
  experience: "Experience points",
  race: "Race",
  subrace: "Subrace",
  size: "Size",
  raceResistance: "Race resistance",
  addedDefenses: "Added resistances and immunities",
  background: "Background",
  abilityScores: "Ability scores",
  abilityIncreases: "Ability score increases",
  proficiencies: "Proficiencies",
  inventory: "Inventory",
  spells: "Spells",
  spellBlocks: "Spell blocks",
  feats: "Feats",
  optionalFeatures: "Optional features",
  featureChoices: "Feature choices",
  weaponMasteries: "Weapon masteries",
  deity: "Deity",
  alignment: "Alignment",
  money: "Money",
  appearance: "Appearance",
  backstory: "Backstory",
  notes: "Notes",
  houseRules: "House rules",
  excludedSources: "Sources",
  departures: "Departures from the rules",
  overrides: "Overrides",
};

/** Sections a person edits one key at a time, so a change names the key. */
const KEYED = new Set<keyof CharacterDefinition>([
  "abilityScores",
  "money",
  "appearance",
  "backstory",
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
  // The sheet labels the box `story` names Backstory, after its page.
  if (section === "backstory" && key === "story") return "Backstory";
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

const sameIds = (was: { id: string }[], now: { id: string }[]) =>
  was.length === now.length && was.every((each, at) => each.id === now[at]?.id);

/**
 * Each retitled section and each edited note, where every section and note kept its place,
 * so editing one note or title merges its own autosave burst and no other. Adding,
 * removing or reordering reads as the notes edited.
 */
function notesChanges(before: CharacterDefinition, after: CharacterDefinition): Change[] {
  const kept =
    sameIds(before.notes, after.notes) &&
    after.notes.every((section, at) => sameIds(before.notes[at]?.notes ?? [], section.notes));
  if (!kept) return [];
  return after.notes.flatMap((section, at) => {
    const was = before.notes[at];
    if (!was) return [];
    const title: Change[] =
      was.title === section.title
        ? []
        : [
            {
              path: `notes.${section.id}.title`,
              label: "Notes section",
              before: was.title,
              after: section.title,
            },
          ];
    const label = section.title.trim() ? `${section.title} note` : "Note";
    const notes = section.notes.flatMap((note, index): Change[] => {
      const from = was.notes[index]?.text;
      if (from === note.text) return [];
      return [{ path: `notes.${section.id}.${note.id}`, label, before: from, after: note.text }];
    });
    return [...title, ...notes];
  });
}

/** Sections whose one-item edit names the item, falling back to the section where none does. */
const ITEMIZED: Partial<
  Record<
    keyof CharacterDefinition,
    (before: CharacterDefinition, after: CharacterDefinition) => Change[]
  >
> = { inventory: inventoryChanges, notes: notesChanges };

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
    const itemized = ITEMIZED[section]?.(before, after) ?? [];
    if (itemized.length > 0) return itemized;
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
  if (!quotable(before) || !quotable(after) || before === after) return `${label} edited`;
  if (blank(before)) return `${label} set to ${quote(after)}`;
  if (blank(after)) return `${label} cleared`;
  return `${label} ${quote(before)} to ${quote(after)}`;
}

/** Every change from `before` to `after`, one phrase each, none where they are the same. */
export const changePhrases = (before: CharacterDefinition, after: CharacterDefinition) =>
  changes(before, after).map(phrase);

/** Past three changes the description names the first two and counts the rest, so a level-up stays one line. */
function describe(found: Change[]) {
  const phrases = found.map(phrase);
  return phrases.length > 3
    ? `${phrases.slice(0, 2).join(", ")} and ${phrases.length - 2} more changes`
    : phrases.join(", ");
}

/** `null` where the two definitions hold the same character. */
export function describeChange(
  before: CharacterDefinition,
  after: CharacterDefinition,
): { paths: string[]; describedAs: string } | null {
  const found = changes(before, after);
  if (found.length === 0) return null;
  return { paths: found.map((change) => change.path), describedAs: describe(found) };
}

const left = (remaining: number, total: number) => `${remaining} of ${total}`;

/** One change per key either side holds, each side's item read through `value`. */
function keyed<T>(
  path: string,
  before: T[],
  after: T[],
  key: (item: T) => string,
  label: (key: string) => string,
  value: (item: T) => string,
): Change[] {
  const keys = new Set([...before, ...after].map(key));
  return [...keys].flatMap((at) => {
    const was = before.find((item) => key(item) === at);
    const now = after.find((item) => key(item) === at);
    if (equal(was, now)) return [];
    return [
      {
        path: `${path}.${at}`,
        label: label(at),
        before: was && value(was),
        after: now && value(now),
      },
    ];
  });
}

/**
 * Compares the values themselves and phrases them through `read`, so a change `read` does
 * not show still records, and reads as the field edited.
 */
const one = <T>(
  path: string,
  label: string,
  before: T,
  after: T,
  read: (value: T) => unknown = (value) => value,
): Change[] =>
  equal(before, after) ? [] : [{ path, label, before: read(before), after: read(after) }];

const slotsLeft = (slot: { total: number; expended: number } | null) =>
  slot ? left(slot.total - slot.expended, slot.total) : undefined;

const names = (conditions: CharacterState["conditions"]) =>
  conditions.map((condition) => condition.name).join(", ");

/**
 * Exhaustive, so a field added to the state fails to compile until it says how it reads.
 * Null current hit points reads as the derived maximum, so it reads as "full".
 */
const STATE_CHANGES: {
  [K in keyof CharacterState]: (before: CharacterState, after: CharacterState) => Change[];
} = {
  hitPoints: (before, after) => [
    ...one(
      "hitPoints.current",
      "Hit points",
      before.hitPoints.current ?? "full",
      after.hitPoints.current ?? "full",
    ),
    ...one(
      "hitPoints.temporary",
      "Temporary hit points",
      before.hitPoints.temporary,
      after.hitPoints.temporary,
    ),
  ],
  hitPointMaximumReduction: (before, after) =>
    one(
      "hitPointMaximumReduction",
      "Hit point maximum reduction",
      before.hitPointMaximumReduction,
      after.hitPointMaximumReduction,
      (held) =>
        held ? `${held.amount} ${held.clearsOnLongRest ? "until" : "past"} a long rest` : undefined,
    ),
  hitDice: (before, after) =>
    keyed(
      "hitDice",
      before.hitDice,
      after.hitDice,
      (pool) => `d${pool.die}`,
      (die) => `${die} hit dice`,
      (pool) => left(pool.remaining, pool.total),
    ),
  spellSlots: (before, after) =>
    keyed(
      "spellSlots",
      before.spellSlots,
      after.spellSlots,
      (slot) => String(slot.level),
      (level) => `Level ${level} spell slots`,
      (slot) => left(slot.total - slot.expended, slot.total),
    ),
  pactSlots: (before, after) =>
    one("pactSlots", "Pact slots", before.pactSlots, after.pactSlots, slotsLeft),
  conditions: (before, after) =>
    one("conditions", "Conditions", before.conditions, after.conditions, names),
  customConditions: (before, after) =>
    one(
      "customConditions",
      "Conditions",
      before.customConditions,
      after.customConditions,
      (conditions) => conditions.join(", "),
    ),
  resources: (before, after) =>
    keyed(
      "resources",
      before.resources,
      after.resources,
      (resource) => resource.name,
      (name) => name,
      (resource) => left(resource.current, resource.maximum),
    ),
  classResources: (before, after) =>
    keyed(
      "classResources",
      before.classResources,
      after.classResources,
      classResourceKey,
      (at) => resourceLabel(at.slice(at.lastIndexOf("|") + 1)),
      (pool) =>
        pool.maximum === null
          ? `${pool.expended} spent`
          : left(pool.maximum - pool.expended, pool.maximum),
    ),
  featureUses: (before, after) =>
    keyed(
      "featureUses",
      before.featureUses,
      after.featureUses,
      (use) => use.key,
      (at) => `${at.slice(at.lastIndexOf("|") + 1)} uses`,
      (use) => `${use.expended} spent`,
    ),
  itemCharges: (before, after) =>
    keyed(
      "itemCharges",
      before.itemCharges,
      after.itemCharges,
      (spent) => spent.id,
      () => "Item charges",
      (spent) => `${spent.expended} spent`,
    ),
  spentAmmunition: (before, after) =>
    keyed(
      "spentAmmunition",
      before.spentAmmunition,
      after.spentAmmunition,
      (spent) => `${spent.type}|${itemKey(spent)}`,
      () => "Ammunition",
      (spent) => `${spent.count} spent`,
    ),
  activeEffects: (before, after) =>
    keyed(
      "activeEffects",
      before.activeEffects,
      after.activeEffects,
      (effect) => effect.name,
      (name) => name,
      () => "active",
    ),
  concentration: (before, after) =>
    one("concentration", "Concentration", before.concentration, after.concentration, (held) =>
      held
        ? `${"homebrewId" in held.spell ? "a homebrew spell" : held.spell.name} at level ${held.level}`
        : undefined,
    ),
  deathSaves: (before, after) => [
    ...one(
      "deathSaves.successes",
      "Death save successes",
      before.deathSaves.successes,
      after.deathSaves.successes,
    ),
    ...one(
      "deathSaves.failures",
      "Death save failures",
      before.deathSaves.failures,
      after.deathSaves.failures,
    ),
  ],
  exhaustion: (before, after) =>
    one("exhaustion", "Exhaustion", before.exhaustion, after.exhaustion),
  inspiration: (before, after) =>
    one("inspiration", "Inspiration", before.inspiration, after.inspiration, (held) =>
      held ? "held" : undefined,
    ),
};

const stateChanges = (before: CharacterState, after: CharacterState) =>
  (Object.keys(STATE_CHANGES) as (keyof CharacterState)[]).flatMap((field) =>
    STATE_CHANGES[field](before, after),
  );

/** Every change from `before` to `after` play state, one phrase each, none where they are the same. */
export const stateChangePhrases = (before: CharacterState, after: CharacterState) =>
  stateChanges(before, after).map(phrase);

/** `null` where the two states are the same. */
export function describeStateChange(before: CharacterState, after: CharacterState) {
  const found = stateChanges(before, after);
  return found.length === 0 ? null : describe(found);
}
