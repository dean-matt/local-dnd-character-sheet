import type { LucideIcon } from "lucide-react";

const TONE = {
  plain: "border-border bg-surface hover:bg-subtle",
  off: "border-error bg-transparent text-error hover:bg-subtle",
  on: "border-error bg-error text-surface",
};

/**
 * An icon button that stays mounted, and so keeps focus, whatever the count: `disabled` marks
 * it with `aria-disabled` and drops the press rather than removing it. A button that toggles a
 * feature passes `on`: a red outline while off, red filled while on.
 */
export function PoolButton({
  icon: Icon,
  label,
  tooltip,
  disabled,
  on,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  tooltip: string;
  disabled: boolean;
  on?: boolean;
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
      className={`flex size-6 items-center justify-center rounded-control border aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${TONE[on === undefined ? "plain" : on ? "on" : "off"]}`}
    >
      <Icon aria-hidden="true" size={14} />
    </button>
  );
}
