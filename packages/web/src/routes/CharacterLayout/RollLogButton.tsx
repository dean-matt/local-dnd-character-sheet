import { Dices } from "lucide-react";
import type { Ref } from "react";

/** Opens and closes the roll log panel `panelId` names. */
export function RollLogButton({
  panelId,
  open,
  onToggle,
  ref,
}: {
  panelId: string;
  open: boolean;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      title="Roll Log"
      className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-expanded:bg-accent-tint aria-expanded:text-ink"
    >
      <Dices size={16} aria-hidden="true" />
      <span className="sr-only">Roll Log</span>
    </button>
  );
}
