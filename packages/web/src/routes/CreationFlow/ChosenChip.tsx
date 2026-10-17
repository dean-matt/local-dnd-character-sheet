import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { SourceChip } from "../../components/SourceChip.tsx";

export interface ChosenChipProps {
  /** What was chosen, such as `Race`, which names the chip and its clear button. */
  label: string;
  value: string;
  /** The book the row comes from, shown as the picker's option shows it. */
  source?: string;
  onClear: () => void;
  /** Moves focus to the clear button on mount, where the picker it replaced held it. */
  focusOnMount?: boolean;
}

/** A choice made through a picker: its label, the chosen row as a pill, and × to clear it. */
export function ChosenChip({
  label,
  value,
  source,
  onClear,
  focusOnMount = false,
}: ChosenChipProps) {
  const clear = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus moves once, on mount.
  useEffect(() => {
    if (focusOnMount) clear.current?.focus();
  }, []);
  return (
    <div className="flex flex-col">
      <span className="mb-1 text-muted text-row">{label}</span>
      <span className="flex w-fit items-center gap-1 rounded-pill border border-border bg-subtle py-1 pr-1 pl-3 text-body">
        {value}
        {source !== undefined && <SourceChip source={source} />}
        <button
          type="button"
          ref={clear}
          onClick={onClear}
          aria-label={`Clear ${label.toLowerCase()}, ${value}`}
          className="flex size-5 items-center justify-center rounded-pill text-muted hover:bg-border"
        >
          <X aria-hidden="true" size={12} />
        </button>
      </span>
    </div>
  );
}
