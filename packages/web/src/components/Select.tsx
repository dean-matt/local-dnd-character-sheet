import { Check } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Dropdown } from "./Dropdown.tsx";

interface SelectOption {
  value: string;
  label: string;
  /** Drawn muted after the label, with the option muted too: why it is a poor pick, without refusing it. */
  hint?: string;
}

/**
 * `id` and the ARIA attributes are `FormField`'s, which name and describe the button.
 * `aria-disabled` keeps the button focusable but refuses to open the list.
 */
export type SelectProps = Pick<
  ComponentProps<"button">,
  "id" | "aria-invalid" | "aria-describedby" | "aria-disabled"
> & {
  options: SelectOption[];
  value: string;
  onChange: (next: string) => void;
};

/** How long a pause ends a typed run of letters, so the next letter starts a new search. */
const TYPEAHEAD_MS = 500;

/**
 * A single choice in `MultiSelect`'s look: a select-only combobox whose button names the
 * chosen option and opens a listbox, the chosen option checked. Focus stays on the button,
 * which points at the active option. Arrow keys, Home and End move it, opening the list
 * first; typing jumps to the first option whose label starts with what was typed in the last
 * half second, opening the list; Enter or Space picks it and closes; Escape or focus leaving
 * closes without picking. Picking the option already chosen calls nothing.
 */
export function Select({ options, value, onChange, ...control }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const buttonId = control.id ?? `${id}-button`;
  const chosen = options.findIndex((option) => option.value === value);
  const optionId = (index: number) => `${id}-option-${index}`;
  const held = control["aria-disabled"] === true || control["aria-disabled"] === "true";
  const typed = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);

  function show(at: number) {
    if (held) return;
    setActive(at);
    setOpen(true);
  }

  function pick(index: number) {
    setOpen(false);
    button.current?.focus();
    const option = options[index];
    if (option && index !== chosen && !held) onChange(option.value);
  }

  /** The option a typed letter leads to, `undefined` where the key types nothing or none matches. */
  function typeahead(event: KeyboardEvent): number | undefined {
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return undefined;
    const now = Date.now();
    const text = (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : "") + event.key;
    // A space opens or picks unless it continues a name being typed.
    if (text === " ") return undefined;
    typed.current = { text, at: now };
    const at = options.findIndex((option) =>
      option.label.toLowerCase().startsWith(text.toLowerCase()),
    );
    return at === -1 ? undefined : at;
  }

  function onKey(event: KeyboardEvent) {
    const lead = typeahead(event);
    if (lead === undefined) return onKeyDown(event);
    event.preventDefault();
    show(lead);
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = options.length - 1;
    const from = open ? active : Math.max(chosen, 0);
    const moves: Record<string, number> = {
      ArrowDown: open ? Math.min(active + 1, last) : from,
      ArrowUp: open ? Math.max(active - 1, 0) : from,
      Home: 0,
      End: last,
    };
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) pick(active);
      else show(from);
      return;
    }
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    show(next);
  }

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      onKeyDown={onKey}
      value={options[chosen]?.label ?? value}
      button={{
        ...control,
        id: buttonId,
        ref: button,
        role: "combobox",
        "aria-haspopup": "listbox",
        "aria-controls": `${id}-list`,
        "aria-activedescendant": open ? optionId(active) : undefined,
        onClick: () => (open ? setOpen(false) : show(Math.max(chosen, 0))),
        // Space acts on keydown; an engine that still activates on keyup would undo it.
        onKeyUp: (event) => {
          if (event.key === " ") event.preventDefault();
        },
      }}
    >
      {(panel) => (
        <div
          ref={panel.ref}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={buttonId}
          // Keeps focus on the button, which owns the keys and the active option.
          onMouseDown={(event) => event.preventDefault()}
          className={panel.className}
          // At least the button's width, and wider where an option needs it: a narrow button
          // would otherwise wrap even a two-digit option onto two lines.
          style={{ ...panel.style, width: "max-content" }}
        >
          {options.map((option, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the button handles the keys, pointing at this option.
            <div
              key={option.value}
              id={optionId(index)}
              role="option"
              // Reachable through the button's aria-activedescendant, never by Tab.
              tabIndex={-1}
              aria-selected={index === chosen}
              onClick={() => pick(index)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-row text-ink ${index === active ? "bg-subtle" : ""}`}
            >
              <Check
                size={14}
                aria-hidden
                className={`shrink-0 text-accent-text ${index === chosen ? "" : "invisible"}`}
              />
              <span className={`min-w-0 break-words ${option.hint ? "text-muted" : ""}`}>
                {option.label}
                {option.hint && ` — ${option.hint}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
