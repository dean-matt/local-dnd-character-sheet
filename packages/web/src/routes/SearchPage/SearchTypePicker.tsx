import { ChevronDown } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";

export interface SearchTypePickerProps {
  /** Each type `/search/types` returns, beside the plural its checkbox reads. */
  options: { type: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/** What the closed button says of the chosen types: every one by name up to two, then a count. */
function summary(options: SearchTypePickerProps["options"], selected: string[]): string {
  if (selected.length === 0) return "All types";
  if (selected.length > 2) return `${selected.length} types`;
  return selected.map((type) => options.find((o) => o.type === type)?.label ?? type).join(", ");
}

/** The checkbox an arrow key lands on, wrapping at either end; from outside the list, the near end. */
function nextIndex(boxes: HTMLInputElement[], step: 1 | -1): number {
  const at = boxes.indexOf(document.activeElement as HTMLInputElement);
  if (at === -1) return step === 1 ? 0 : boxes.length - 1;
  return (at + step + boxes.length) % boxes.length;
}

const toggled = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * The search page's type filter: a button naming the chosen types that opens a list of
 * checkboxes, one per type. Arrow keys and Tab move through the checkboxes, Space ticks one,
 * and Escape or focus leaving closes the list, Escape returning focus to the button.
 */
export function SearchTypePicker({ options, selected, onChange }: SearchTypePickerProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLFieldSetElement>(null);
  const id = useId();

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const boxes = [...(list.current?.querySelectorAll("input") ?? [])];
    if (boxes.length === 0) return;
    event.preventDefault();
    boxes[nextIndex(boxes, event.key === "ArrowDown" ? 1 : -1)]?.focus();
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape, the arrow keys and focusout bubbling from the button and its checkboxes.
    <div
      className="relative flex min-w-0 flex-col gap-2"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span
        id={`${id}-label`}
        className="text-label font-semibold uppercase tracking-label text-muted"
      >
        Type
      </span>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen(!open)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-control border border-border bg-surface px-2 py-1.5 text-row text-ink"
      >
        <span id={`${id}-value`} className="truncate">
          {summary(options, selected)}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className="shrink-0 text-muted"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {open && (
        <fieldset
          ref={list}
          id={`${id}-list`}
          // A press on a label's text focuses nothing, and Safari never focuses a clicked
          // checkbox, so the blur above would close the list before the click toggled it.
          tabIndex={-1}
          className="absolute top-full left-0 z-30 mt-1 flex max-h-80 w-full min-w-0 flex-col overflow-y-auto rounded-control border border-border bg-surface p-1.5 shadow-popover outline-none"
        >
          <legend className="sr-only">Types to search</legend>
          {options.map(({ type, label }) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-row text-ink hover:bg-subtle"
            >
              <input
                type="checkbox"
                checked={selected.includes(type)}
                onChange={() => onChange(toggled(selected, type))}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
