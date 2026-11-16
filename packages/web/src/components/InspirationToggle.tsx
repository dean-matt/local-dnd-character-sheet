import { Zap } from "lucide-react";
import type { useInspiration } from "../hooks/useInspiration.ts";

/** The control that marks a roll to spend inspiration on; see `useInspiration`. */
export function InspirationToggle({
  effect,
  blocked,
  spending,
  toggleable,
  toggle,
}: Pick<
  ReturnType<typeof useInspiration>,
  "effect" | "blocked" | "spending" | "toggleable" | "toggle"
>) {
  return (
    <button
      type="button"
      aria-label="Inspiration"
      aria-pressed={spending}
      aria-disabled={!toggleable || undefined}
      title={
        blocked
          ? "A reroll needs the normal mode and no extra die"
          : `Spend inspiration for ${effect === "advantage" ? "advantage" : "a reroll"}`
      }
      onClick={toggle}
      className="flex size-6 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-text"
    >
      <Zap size={14} aria-hidden="true" fill={spending ? "currentColor" : "none"} />
    </button>
  );
}
