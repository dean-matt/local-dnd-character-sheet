import type { RestChange } from "./restChanges.ts";

/** What a rest changes, before and after, or why there is nothing to list. */
export function ChangeList({ changes }: { changes: RestChange[] | undefined }) {
  if (changes === undefined) {
    return <p className="text-muted">Pick the hit dice to recover to see what the rest changes.</p>;
  }
  if (changes.length === 0) return <p className="text-muted">This rest changes nothing.</p>;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-row">
      {changes.map((change) => (
        <div key={change.key} className="contents">
          <dt>{change.label}</dt>
          <dd className="text-right font-semibold tabular-nums">
            {change.before} → {change.after}
          </dd>
        </div>
      ))}
    </dl>
  );
}
