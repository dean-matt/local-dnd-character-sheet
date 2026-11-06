import type { LucideIcon } from "lucide-react";

/**
 * An icon button that stays mounted, and so keeps focus, whatever the count: `disabled` marks
 * it with `aria-disabled` and drops the press rather than removing it.
 */
export function PoolButton({
  icon: Icon,
  label,
  tooltip,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onPress();
      }}
      className="flex size-6 items-center justify-center rounded-control border border-border bg-surface hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <Icon aria-hidden="true" size={14} />
    </button>
  );
}
