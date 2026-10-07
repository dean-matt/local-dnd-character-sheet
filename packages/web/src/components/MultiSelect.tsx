import { SlidersHorizontal } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Dropdown } from "./Dropdown.tsx";

interface MultiSelectOption {
  value: string;
  label: string;
  /** A shorter name for the closed button, such as a source's abbreviation. */
  short?: string;
  /** What choosing it does beyond the filter, such as "adds rarity and kind filters", marked by an icon. */
  hint?: string;
}

export interface MultiSelectProps {
  /** The heading above the button, such as "Source". */
  label: string;
  /** The plural the button and the filter read, such as "sources". */
  noun: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Past this many options the list opens with a filter input. */
const FILTER_ABOVE = 10;
/** The longest two names the closed button joins before it counts them instead. */
const SHORT_SUMMARY = 20;

/** What the closed button says: all, one by name, two by name while short, then a count. */
function summary(options: MultiSelectOption[], selected: string[], noun: string): string {
  if (selected.length === 0) return `All ${noun}`;
  const names = selected.map((value) => {
    const option = options.find((o) => o.value === value);
    return option?.short ?? option?.label ?? value;
  });
  const joined = names.join(", ");
  if (names.length === 1 || (names.length === 2 && joined.length <= SHORT_SUMMARY)) return joined;
  return `${selected.length} ${noun}`;
}

/** The checkbox an arrow key lands on, wrapping at either end; from outside the list, the near end. */
function nextIndex(boxes: HTMLInputElement[], step: 1 | -1): number {
  const at = boxes.indexOf(document.activeElement as HTMLInputElement);
  if (at === -1) return step === 1 ? 0 : boxes.length - 1;
  return (at + step + boxes.length) % boxes.length;
}

const toggled = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A button naming the chosen values that opens a list of checkboxes, one per option, no
 * wider than the button, the values already chosen first. A long list opens with a filter
 * input, focused, that narrows the rows by value or label. Arrow keys move through the shown
 * checkboxes, Space ticks one, and Escape or focus leaving closes the list, Escape returning
 * focus to the button. Clear, beside the heading while anything is chosen, unticks them all.
 */
export function MultiSelect({ label, noun, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // The values chosen when the list opened, which lead it; ticking one does not move its row.
  const [leading, setLeading] = useState<string[]>([]);
  const button = useRef<HTMLButtonElement>(null);
  const filter = useRef<HTMLInputElement>(null);
  const id = useId();
  const filterable = options.length > FILTER_ABOVE;
  const needle = query.trim().toLowerCase();
  const shown = [
    ...options.filter((o) => leading.includes(o.value)),
    ...options.filter((o) => !leading.includes(o.value)),
  ].filter((o) => o.value.toLowerCase().includes(needle) || o.label.toLowerCase().includes(needle));

  useEffect(() => {
    if (open) filter.current?.focus();
  }, [open]);

  function toggle() {
    setQuery("");
    setLeading(selected);
    setOpen(!open);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const boxes = [
      ...event.currentTarget.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    ];
    if (boxes.length === 0) return;
    event.preventDefault();
    boxes[nextIndex(boxes, event.key === "ArrowDown" ? 1 : -1)]?.focus();
  }

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      onKeyDown={onKeyDown}
      value={summary(options, selected, noun)}
      valueId={`${id}-value`}
      button={{
        ref: button,
        "aria-controls": `${id}-list`,
        "aria-labelledby": `${id}-label ${id}-value`,
        onClick: toggle,
      }}
      header={
        // A fixed height, so Clear appearing moves nothing below it.
        <div className="flex h-6 items-center justify-between">
          <span
            id={`${id}-label`}
            className="text-label font-semibold uppercase tracking-label text-muted"
          >
            {label}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              aria-label={`Clear ${noun}`}
              onClick={() => {
                onChange([]);
                button.current?.focus();
              }}
              className="rounded-control px-2 py-0.5 text-row font-semibold text-accent-text hover:bg-subtle"
            >
              Clear
            </button>
          )}
        </div>
      }
    >
      {(panel) => (
        <fieldset
          ref={panel.ref}
          id={`${id}-list`}
          // A press on a label's text focuses nothing, and Safari never focuses a clicked
          // checkbox, so the dropdown's blur would close the list before the click toggled it.
          tabIndex={-1}
          className={panel.className}
          style={panel.style}
        >
          <legend className="sr-only">{capitalize(noun)} to search</legend>
          {filterable && (
            <input
              ref={filter}
              type="search"
              autoComplete="off"
              aria-label={`Filter ${noun}`}
              placeholder={`Filter ${noun}…`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mb-1 w-full min-w-0 rounded-control border border-border bg-surface px-2 py-1 text-row text-ink"
            />
          )}
          {shown.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-row text-ink hover:bg-subtle"
            >
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={selected.includes(option.value)}
                onChange={() => onChange(toggled(selected, option.value))}
              />
              <span className="min-w-0 break-words">
                {option.label}
                {option.hint && " "}
                {option.hint && <span className="sr-only">({option.hint})</span>}
              </span>
              {option.hint && (
                <span
                  aria-hidden
                  title={option.hint}
                  className="mt-0.5 ml-auto shrink-0 text-muted"
                >
                  <SlidersHorizontal size={14} />
                </span>
              )}
            </label>
          ))}
          {shown.length === 0 && (
            <p className="px-2 py-1.5 text-row text-muted italic">
              No {noun} match "{query}".
            </p>
          )}
        </fieldset>
      )}
    </Dropdown>
  );
}
