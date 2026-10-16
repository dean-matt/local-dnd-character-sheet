import { ChevronDown } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useTopLayer } from "../hooks/useTopLayer.ts";
import { anchoredListStyle, anchorName, DROPDOWN_PANEL } from "../lib/anchoring.ts";

/** `id` and the ARIA attributes are `FormField`'s, which name and describe the input. */
export type ComboboxProps = Pick<
  ComponentProps<"input">,
  "id" | "aria-invalid" | "aria-describedby" | "placeholder"
> & {
  /** The values the list offers; any other typed value is kept as it is. */
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
};

/**
 * A text input with a list of suggestions under it in `Select`'s look: an editable combobox.
 * Typing narrows the list to the options holding the text, and a value that is one of them
 * offers them all. The chevron, a click on the input, or Down opens it; Up and Down move
 * through it, Enter or a click fills the input, and Escape or focus leaving closes it. Focus
 * stays in the input, which points at the active option.
 */
export function Combobox({ options, value, onChange, ...control }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const anchor = anchorName(id);
  useTopLayer(panel, open);
  const needle = value.trim().toLowerCase();
  const shown =
    needle === "" || options.includes(value)
      ? options
      : options.filter((option) => option.toLowerCase().includes(needle));
  const listed = open && shown.length > 0;
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    if (listed && active >= 0)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [listed, active, id]);

  function pick(option: string) {
    setOpen(false);
    input.current?.focus();
    if (option !== value) onChange(option);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const last = shown.length - 1;
      if (!open) {
        setOpen(true);
        setActive(Math.max(shown.indexOf(value), 0));
      } else
        setActive(event.key === "ArrowDown" ? Math.min(active + 1, last) : Math.max(active - 1, 0));
    } else if (event.key === "Enter" && listed && shown[active] !== undefined) {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focusout bubbling from the input and the list.
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        {...control}
        ref={input}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={listed}
        aria-controls={`${id}-list`}
        aria-activedescendant={listed && active >= 0 ? optionId(active) : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{ anchorName: anchor }}
        className="control w-full pr-7"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen(!open);
          input.current?.focus();
        }}
        className="absolute inset-y-0 right-0 flex w-7 items-center justify-center text-muted"
      >
        <ChevronDown size={14} style={{ transform: listed ? "rotate(180deg)" : undefined }} />
      </button>
      {listed && (
        <div
          ref={(element) => {
            panel.current = element;
          }}
          id={`${id}-list`}
          role="listbox"
          // Keeps focus in the input, which owns the keys and the active option.
          onMouseDown={(event) => event.preventDefault()}
          className={DROPDOWN_PANEL}
          style={anchoredListStyle(anchor)}
        >
          {shown.map((option, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the keys, pointing at this option.
            <div
              key={option}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={option === value}
              onClick={() => pick(option)}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer rounded-lg px-2 py-1.5 text-row text-ink ${index === active ? "bg-subtle" : ""}`}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
