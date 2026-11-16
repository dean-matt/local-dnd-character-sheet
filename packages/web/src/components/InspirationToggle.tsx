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
      aria-pressed={spending}
      aria-disabled={!toggleable || undefined}
      title={
        blocked
          ? "A reroll needs the normal mode and no extra die"
          : `Spend inspiration for ${effect === "advantage" ? "advantage" : "a reroll"}`
      }
      onClick={toggle}
      className="min-h-6 rounded-control border border-border px-1 text-label aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-text"
    >
      Inspiration
    </button>
  );
}
