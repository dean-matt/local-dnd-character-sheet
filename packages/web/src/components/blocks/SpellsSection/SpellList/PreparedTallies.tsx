import type { PreparedTally } from "./spellCaster.ts";

/**
 * How many spells each preparing class has prepared against how many it may. A count past
 * the limit is reported here and never refused, since a table may allow it.
 */
export function PreparedTallies({ tallies }: { tallies: readonly PreparedTally[] }) {
  if (tallies.length === 0) return null;
  return (
    <ul aria-live="polite" className="flex flex-col gap-0.5 text-row">
      {tallies.map(({ name, prepared, limit }) => (
        <li
          key={name}
          className={prepared > limit ? "font-semibold text-accent-text" : "text-muted"}
        >
          {name}: {prepared} of {limit} prepared
          {prepared > limit && ` — ${prepared - limit} more than ${name} may prepare`}
        </li>
      ))}
    </ul>
  );
}
