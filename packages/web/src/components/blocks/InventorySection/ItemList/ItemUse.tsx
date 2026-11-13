import { TOGGLE_PILL } from "../../../../lib/chipStyles.ts";

/** Spends one of a carried consumable; it stays enabled at any count, since the last use removes the entry. */
export function ItemUse({ name, busy, onUse }: { name: string; busy: boolean; onUse: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Use ${name}`}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onUse();
      }}
      className={`${TOGGLE_PILL} border-border bg-surface text-muted`}
    >
      Use
    </button>
  );
}
