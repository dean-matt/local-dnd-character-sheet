import type { LevelChange } from "./levelUpChanges.ts";

/**
 * What the level changed, once it is applied: each value before and after, then the
 * features that arrived. `changes` is `undefined` while the sheet recomputes.
 */
export function LevelUpSummary({
  changes,
  features,
}: {
  changes: readonly LevelChange[] | undefined;
  features: readonly string[];
}) {
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {changes === undefined ? (
        <p className="text-muted">Working out what changed…</p>
      ) : changes.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {changes.map((change) => (
            <div key={change.label} className="contents">
              <dt className="font-semibold">{change.label}</dt>
              <dd>
                {change.before} → {change.after}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted">No value on the sheet moved.</p>
      )}
      {features.length > 0 && (
        <p>
          <span className="font-semibold">New features:</span> {features.join(", ")}
        </p>
      )}
    </div>
  );
}
