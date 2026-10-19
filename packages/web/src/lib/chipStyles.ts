/** The shape every chip shares, whatever its colors. */
export const CHIP = "rounded-chip border px-1.25 py-0.5 font-bold text-chip tracking-chip";

export const PILL = "rounded-pill border border-border bg-subtle px-2.5 py-1 text-row";

/** A pill a row presses to set a flag, such as Attuned or Prepared. */
export const TOGGLE_PILL =
  "rounded-pill border px-2 py-0.5 font-bold text-chip leading-3 tracking-chip uppercase";

/** A pill pressed to choose it, such as one option among a few or a spell to prepare. */
export const PRESS_PILL =
  "rounded-pill border border-border px-3 py-1 font-semibold text-row aria-pressed:border-accent aria-pressed:bg-accent-tint";

/** The heading over a list of picks, such as Cantrips. */
export const PICK_HEADING = "font-semibold text-label text-muted uppercase tracking-label";
