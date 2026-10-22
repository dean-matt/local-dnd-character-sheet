import type { LevelChange } from "./levelUpChanges.ts";

/**
 * What the level changes: each value before and after, then the features that arrive.
 * `changes` is `undefined` while the sheet recomputes, and `emptyNote` stands in for a list
 * with nothing in it.
 */
export function LevelUpSummary({
  changes,
  features,
  emptyNote,
}: {
  changes: readonly LevelChange[] | undefined;
  features: readonly string[];
  emptyNote?: string;
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
        emptyNote && <p className="text-muted">{emptyNote}</p>
      )}
      {features.length > 0 && (
        <p>
          <span className="font-semibold">New features:</span> {features.join(", ")}
        </p>
      )}
    </div>
  );
}
