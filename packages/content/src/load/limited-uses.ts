/**
 * A feature's limited uses, read from its rules text: how many times it can be used and
 * which rest restores them. `short` means a short or a long rest; `long`, a long rest only.
 *
 * Text that says one count and one reset yields them. Text that says none, or says more
 * than one — Action Surge's once becoming twice at 17th level, a use regained on a short
 * rest and all of them on a long one — yields nothing rather than a guess, as does a count
 * the text ties to a modifier, the proficiency bonus, a class level or each of several
 * spells, and a limit stated by more than one named part of the feature. Widening it means
 * adding a pattern here and its sentence to the test.
 */
import { parseTags, renderText } from "@dnd/tags";
import { isRecord } from "./json.ts";

type LimitedUses = { uses: number; reset: "short" | "long" };

const COUNTS: Record<string, number> = {
  once: 1,
  twice: 2,
  thrice: 3,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const COUNT = "(?<count>once|twice|thrice|(?:two|three|four|five|six|seven|eight|nine|ten) times)";
const REST = "(?<rest>short or long rest|short rest or long rest|long rest|short rest)";
const AGAIN = String.raw`(?:use (?:it|this \w+)|do so|\w+ (?:it|either spell|that spell|the spell)) again`;

const pattern = (source: string) => new RegExp(source, "i");

/** A sentence's count and rest, read from the `count` and `rest` groups; `once` counts one. */
const READERS: { pattern: RegExp; once?: true }[] = [
  {
    pattern: pattern(String.raw`\bcan(?:'|’|no)t ${AGAIN} until (?:you )?finish (?:a )?${REST}`),
    once: true,
  },
  {
    pattern: pattern(String.raw`\bmust finish (?:a )?${REST} before you can ${AGAIN}`),
    once: true,
  },
  {
    pattern: pattern(
      String.raw`\byou can use (?:this|it)\b[^.]*?\b${COUNT}(?:[^.]*?\bfinish (?:a )?${REST})?`,
    ),
  },
  {
    pattern: pattern(
      String.raw`\b${COUNT} (?:before|between) (?:a |your next )?(?<rest>\w+(?: or long)? rests?)\b`,
    ),
  },
  {
    pattern: pattern(
      String.raw`\bregain (?:all|any)\b[^.]*?\buses?\b[^.]*?\bfinish (?:a )?${REST}`,
    ),
  },
];
const UNREADABLE =
  /\bregain (?:one|a single)\b[^.]*?\b(?:uses?|dice|die)\b|\bnumber of times\b[^.]*?\b(?:equal to|shown|based on)\b|\bcast each of\b/i;

const restOf = (phrase = ""): LimitedUses["reset"] | undefined =>
  /\bshort\b/i.test(phrase) ? "short" : /\blong\b/i.test(phrase) ? "long" : undefined;

type Sentence = { text: string; part: string };

/**
 * The sentences of an entries tree, by `entries`, `items` and `entry`, with markup rendered,
 * each with the name of the nearest named entry holding it, or "" for none.
 */
function sentences(node: unknown, part = ""): Sentence[] {
  if (typeof node === "string") {
    return renderText(parseTags(node))
      .split(/(?<=[.!?])\s+/)
      .map((text) => ({ text, part }));
  }
  if (Array.isArray(node)) return node.flatMap((child) => sentences(child, part));
  if (!isRecord(node)) return [];
  const named = typeof node.name === "string" ? node.name : part;
  return [node.entries, node.items, node.entry].flatMap((child) => sentences(child, named));
}

export function limitedUses(entries: unknown): LimitedUses | undefined {
  const counts = new Set<number | undefined>();
  const resets = new Set<LimitedUses["reset"] | undefined>();
  const parts = new Set<string>();
  for (const { text, part } of sentences(entries)) {
    if (UNREADABLE.test(text)) return undefined;
    for (const { pattern, once } of READERS) {
      const groups = text.match(pattern)?.groups;
      if (!groups) continue;
      counts.add(once ? 1 : COUNTS[groups.count?.toLowerCase().split(" ")[0] ?? ""]);
      resets.add(restOf(groups.rest));
      parts.add(part);
    }
  }
  if (parts.size > 1) return undefined;
  const uses = only(counts);
  const reset = only(resets);
  return uses === undefined || reset === undefined ? undefined : { uses, reset };
}

/** The one value the text states, or undefined where it states none or several. */
function only<T>(values: Set<T | undefined>): T | undefined {
  values.delete(undefined);
  return values.size === 1 ? [...values][0] : undefined;
}

/** A feature row's `uses` and `uses_reset`, both null where the text yields none. */
export function usesColumns(entries: unknown): { uses: number | null; uses_reset: string | null } {
  const found = limitedUses(entries);
  return { uses: found?.uses ?? null, uses_reset: found?.reset ?? null };
}

/**
 * A race row's `trait_uses`: each top-level named trait with limited uses, by name, or
 * null where none has any. A name two traits share is dropped, since a reader looking
 * it up could not tell which one it meant.
 */
export function traitUses(entries: unknown): string | null {
  const byName = new Map<string, LimitedUses | undefined>();
  for (const node of Array.isArray(entries) ? entries : []) {
    if (!isRecord(node) || typeof node.name !== "string") continue;
    byName.set(node.name, byName.has(node.name) ? undefined : limitedUses(node.entries));
  }
  const found = [...byName].filter(([, uses]) => uses !== undefined);
  return found.length === 0 ? null : JSON.stringify(Object.fromEntries(found));
}
