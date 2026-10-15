/**
 * The page lists a character's page writes replaced, newest last, so a page edit can be
 * undone. The server's undo log covers the definition alone, so this one lives beside the
 * query cache for the session, is lost on a reload, and is bounded like the server's, at
 * `UNDO_LOG_LIMIT`.
 */
import { type CharacterPageRecord, UNDO_LOG_LIMIT } from "@dnd/character";
import type { QueryClient } from "@tanstack/react-query";

interface Entry {
  before: CharacterPageRecord[];
  /** Names the edit; a write repeating the newest entry's key merges into it. */
  key: string | undefined;
}

interface History {
  entries: Map<string, Entry[]>;
  listeners: Set<() => void>;
}

// Keyed by the client so each app, and each test, holds a history of its own.
const histories = new WeakMap<QueryClient, History>();

function historyOf(client: QueryClient): History {
  let history = histories.get(client);
  if (!history) {
    history = { entries: new Map(), listeners: new Set() };
    histories.set(client, history);
  }
  return history;
}

function set(client: QueryClient, characterId: string, entries: Entry[]) {
  const history = historyOf(client);
  history.entries.set(characterId, entries);
  for (const listener of history.listeners) listener();
}

export function subscribePageHistory(client: QueryClient, listener: () => void) {
  const { listeners } = historyOf(client);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pageHistoryDepth(client: QueryClient, characterId: string): number {
  return historyOf(client).entries.get(characterId)?.length ?? 0;
}

/**
 * Records `before` as what an undo restores, and returns the entry it opened. A run of
 * writes sharing a `key`, such as a title's debounced saves, is one entry holding the list
 * before the first of them, so a later write in the run opens none.
 */
export function rememberPages(
  client: QueryClient,
  characterId: string,
  before: CharacterPageRecord[],
  key?: string,
): Entry | undefined {
  const entries = historyOf(client).entries.get(characterId) ?? [];
  if (key !== undefined && entries.at(-1)?.key === key) return undefined;
  const entry = { before, key };
  set(client, characterId, [...entries, entry].slice(-UNDO_LOG_LIMIT));
  return entry;
}

/**
 * Removes `entry` wherever it sits. A later write in its run goes with it, which costs that
 * write its undo; the run's first write failing makes that rare.
 */
export function forgetPages(client: QueryClient, characterId: string, entry: Entry): void {
  const entries = historyOf(client).entries.get(characterId) ?? [];
  if (entries.includes(entry))
    set(
      client,
      characterId,
      entries.filter((each) => each !== entry),
    );
}

/**
 * Removes and returns the newest entry's list, or `undefined` with nothing to undo. The
 * entry it uncovers stops merging, so an edit after the undo starts an entry of its own.
 */
export function takeLastPages(
  client: QueryClient,
  characterId: string,
): CharacterPageRecord[] | undefined {
  const entries = historyOf(client).entries.get(characterId) ?? [];
  const last = entries.at(-1);
  if (!last) return undefined;
  const rest = entries.slice(0, -1);
  const uncovered = rest.at(-1);
  if (uncovered) rest[rest.length - 1] = { ...uncovered, key: undefined };
  set(client, characterId, rest);
  return last.before;
}
