import { Popover } from "../../../../Popover.tsx";

const PILL =
  "rounded-pill border px-2 py-0.5 font-bold text-chip leading-3 tracking-chip uppercase";

/**
 * Presses to attune and again to end it. Where no slot is free, the pill opens `refusal`
 * in place of pressing, so the player learns which items hold the slots.
 */
export function AttuneToggle({
  name,
  attuned,
  refusal,
  onChange,
}: {
  name: string;
  attuned: boolean;
  refusal: string | undefined;
  onChange: (attuned: boolean) => void;
}) {
  if (!attuned && refusal) {
    return (
      <Popover
        trigger={<span className={`${PILL} border-border text-muted`}>Attune</span>}
        triggerLabel={`Attune ${name}, no slot free`}
        label="Attunement"
      >
        {refusal}
      </Popover>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Attuned, ${name}`}
      aria-pressed={attuned}
      onClick={() => onChange(!attuned)}
      className={`${PILL} ${attuned ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"}`}
    >
      {attuned ? "Attuned" : "Attune"}
    </button>
  );
}
