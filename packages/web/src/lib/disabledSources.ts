/**
 * The sources a reader turned off in Settings, kept in this browser's `localStorage`
 * beside the theme. The preference is neither catalog data nor a character's, so none of
 * the three databases holds it, and a cleared browser costs only a few toggles. An absent
 * source is searchable, so a source a catalog rebuild adds starts on.
 */
import { z } from "zod";

const STORAGE_KEY = "disabledSources";

const storedSchema = z.array(z.string());

const listeners = new Set<() => void>();

let current: readonly string[] | undefined;

function load(): readonly string[] {
  try {
    const parsed = storedSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Sorted, so the list doubles as a stable query key. Read once, then held in memory. */
export function getDisabledSources(): readonly string[] {
  current ??= load();
  return current;
}

export function setDisabledSources(sources: Iterable<string>): void {
  current = [...new Set(sources)].sort();
  try {
    if (current.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can throw in private mode or with blocked site data. The list in memory
    // still applies for this session; it just doesn't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function subscribeDisabledSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
