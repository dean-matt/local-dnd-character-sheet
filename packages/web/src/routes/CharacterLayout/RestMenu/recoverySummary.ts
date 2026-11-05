import type { RestChange } from "./restChanges.ts";

const SHOWN = 2;

/**
 * What a rest recovers, as one line for the Rest menu: up to two names, then a count of the
 * rest. Pact slots read as one name, and two resources sharing a name as that name once.
 */
export function recoverySummary(changes: readonly RestChange[]): string {
  const names = [
    ...new Set(changes.map((change) => (change.key === "pact" ? "pact slots" : change.label))),
  ];
  if (names.length === 0) return "Nothing to recover";
  if (names.length <= SHOWN) return `Recover ${names.join(" and ")}`;
  return `Recover ${names.slice(0, SHOWN).join(", ")} +${names.length - SHOWN} more`;
}
