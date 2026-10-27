import type { HomebrewSkillRecord } from "@dnd/catalog";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useTopLayer } from "../../../hooks/useTopLayer.ts";
import { ANCHORED_LIST_CLASSES, anchoredListStyle, anchorName } from "../../../lib/anchoring.ts";
import { FormField } from "../../FormField.tsx";

/**
 * A combobox over the homebrew skills offered. The list stays shut until the input is clicked,
 * a term is typed or an arrow key is pressed; a term narrows it to the names holding the text,
 * and a term nothing holds says "No matches" in the list.
 * Focus stays in the input, which points at the active row; Enter or a click picks it and
 * Escape closes the list.
 */
export function HomebrewSkillPicker({
  skills,
  onPick,
}: {
  skills: readonly HomebrewSkillRecord[];
  onPick: (skill: HomebrewSkillRecord) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const anchor = anchorName(id);
  const needle = query.trim().toLowerCase();
  const shown = skills.filter(({ name }) => name.toLowerCase().includes(needle));
  const listShown = open;
  const activeIndex = shown.length > 0 && active < shown.length ? active : -1;
  useTopLayer(list, listShown);

  useEffect(() => {
    if (activeIndex >= 0)
      document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
  });

  function move(step: 1 | -1) {
    setOpen(true);
    if (shown.length === 0) return;
    const from = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex;
    setActive((from + step + shown.length) % shown.length);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const skill = shown[activeIndex];
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter") {
      // Cancelled even with no row active, so Enter never submits an enclosing form.
      if (skill) onPick(skill);
    } else if (event.key === "Escape" && open) setOpen(false);
    else return;
    event.preventDefault();
  }

  return (
    <FormField label="Search homebrew skills" labelHidden>
      {(control) => (
        <div className="flex flex-col gap-1">
          <input
            {...control}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={listShown}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex === -1 ? undefined : optionId(activeIndex)}
            placeholder="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            style={{ anchorName: anchor }}
            className="control"
          />
          {/* A mousedown on a row or the scrollbar is cancelled so it never blurs the input,
              which closes the list. */}
          <div
            ref={list}
            id={listboxId}
            role="listbox"
            aria-label="Homebrew skills"
            onMouseDown={(event) => event.preventDefault()}
            hidden={!listShown}
            // Below the field unless it does not fit there, rather than wherever has more room.
            style={{ ...anchoredListStyle(anchor), positionTryOrder: "normal" }}
            className={`${ANCHORED_LIST_CLASSES} overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-popover`}
          >
            {shown.length === 0 && (
              <div
                role="option"
                tabIndex={-1}
                aria-disabled="true"
                aria-selected="false"
                className="px-2 py-1.5 text-body text-muted"
              >
                No matches
              </div>
            )}
            {shown.map((skill, index) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: focus stays in the combobox input, which handles every key.
              <div
                key={skill.id}
                id={optionId(index)}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActive(index)}
                onClick={() => onPick(skill)}
                className={`flex cursor-pointer items-baseline justify-between gap-2 rounded-control px-2 py-1.5 text-body ${
                  index === activeIndex ? "bg-accent-tint" : ""
                }`}
              >
                {skill.name}
                <span className="text-muted text-row">
                  {skill.json.ability === "flat" ? "Flat bonus" : skill.json.ability.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </FormField>
  );
}
