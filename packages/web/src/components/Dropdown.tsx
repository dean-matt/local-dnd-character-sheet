import { ChevronDown } from "lucide-react";
import type { ComponentProps, KeyboardEvent, ReactNode, RefObject } from "react";

export interface DropdownProps {
  open: boolean;
  onClose: () => void;
  /** The button's own attributes: its name, its role and popup, and its click. */
  button: Omit<ComponentProps<"button">, "type" | "className" | "children" | "ref"> & {
    ref: RefObject<HTMLButtonElement | null>;
  };
  /** What the button shows, truncated to its width. */
  value: ReactNode;
  valueId?: string;
  /** Anything above the button, such as a heading. */
  header?: ReactNode;
  /** Keys bubbling from the button and the panel, after Escape has been handled. */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** The panel, rendered only while open, given the classes that place it under the button. */
  children: (panelClassName: string) => ReactNode;
}

const PANEL =
  "absolute top-full left-0 z-30 mt-1 flex max-h-80 w-full min-w-0 flex-col overflow-y-auto rounded-control border border-border bg-surface p-1.5 shadow-popover outline-none";

/**
 * The shell `MultiSelect` and `Select` share: a button naming the value with a chevron, and
 * a panel below it no wider than the button. Escape closes the panel and returns focus to
 * the button; focus leaving the whole closes it.
 */
export function Dropdown({
  open,
  onClose,
  button,
  value,
  valueId,
  header,
  onKeyDown,
  children,
}: DropdownProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape, the arrow keys and focusout bubbling from the button and the panel.
    <div
      className="relative flex min-w-0 flex-col gap-1"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          onClose();
          button.ref.current?.focus();
          return;
        }
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      {header}
      <button
        {...button}
        type="button"
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-control border border-border bg-surface px-2 py-1.5 text-row text-ink aria-invalid:border-error"
      >
        <span id={valueId} className="truncate">
          {value}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className="shrink-0 text-muted"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open && children(PANEL)}
    </div>
  );
}
