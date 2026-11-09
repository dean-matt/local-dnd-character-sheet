import { useRef, useState } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowMove } from "./HomebrewRowMove.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";
import { MonsterRulesTable } from "./MonsterRulesTable.tsx";
import { entriesOfParts, type RulesPart, rulesParts } from "./monsterShapes.ts";

export interface MonsterRulesTextProps {
  /** The row's label, which each control's label starts with: `Traits 1`. */
  label: string;
  /** The row as a button names it: `trait 1`. */
  name: string;
  /** The rules text to start with, which `rulesParts` reads; the component holds it from there. */
  entries: unknown;
  onEntries: (entries: unknown[] | undefined) => void;
}

type Part = RulesPart & { id: number };

const join = (...texts: string[]) => texts.filter((text) => text.trim()).join("\n\n");

const kindOf = (part: RulesPart) =>
  "items" in part ? "list" : "rows" in part ? "table" : "section";

/**
 * A row's rules text: paragraphs, then each list, table or named section with the paragraphs after it.
 * A list shows its items one to a line, a table its caption, column labels and cells, a section
 * its name and paragraphs; a section can be moved past the list, table or section beside it. A blank
 * item, paragraph, table or section stays on screen but writes nothing.
 */
export function MonsterRulesText({ label, name, entries, onEntries }: MonsterRulesTextProps) {
  const next = useRef(0);
  const [parts, setParts] = useState<Part[]>(() =>
    (rulesParts(entries) ?? [{ text: "" }]).map((part) => ({ ...part, id: next.current++ })),
  );
  const write = (changed: Part[]) => {
    setParts(changed);
    onEntries(entriesOfParts(changed));
  };
  const change = (index: number, part: RulesPart) =>
    write(parts.map((each, at) => (at === index ? { ...part, id: each.id } : each)));
  const remove = (index: number) => {
    const before = parts[index - 1];
    const after = parts[index + 1];
    write([
      ...parts.slice(0, index - 1),
      {
        text: join(
          before && "text" in before ? before.text : "",
          after && "text" in after ? after.text : "",
        ),
        id: next.current++,
      },
      ...parts.slice(index + 2),
    ]);
  };
  const move = (from: number, to: number) => {
    const changed = [...parts];
    [changed[from], changed[to]] = [changed[to] as Part, changed[from] as Part];
    write(changed);
  };
  const add = (block: RulesPart) =>
    write([...parts, { ...block, id: next.current++ }, { text: "", id: next.current++ }]);
  const counts = { list: 0, table: 0, section: 0 };
  const numbers = parts.map((part) => ("text" in part ? 0 : ++counts[kindOf(part)]));
  const blocks = parts.length > 1;
  const textLabel = (index: number) => {
    const before = parts[index - 1];
    return before
      ? `${label} rules text after ${kindOf(before)} ${numbers[index - 1]}`
      : `${label} rules text`;
  };
  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, index) => {
        if ("text" in part) {
          return (
            <HomebrewRulesText
              key={part.id}
              label={textLabel(index)}
              text={part.text}
              onText={(text) => change(index, { text })}
              rows={blocks ? 3 : 8}
            />
          );
        }
        const kind = kindOf(part);
        const of = `${kind} ${numbers[index]} of ${name}`;
        const title = `${label} ${kind} ${numbers[index]}`;
        const removeButton = (
          <button
            type="button"
            aria-label={`Remove ${of}`}
            onClick={() => remove(index)}
            className={ROW_BUTTON}
          >
            Remove {kind}
          </button>
        );
        if ("items" in part) {
          return (
            <fieldset
              key={part.id}
              className="flex min-w-0 flex-col gap-2 border-border border-l-2 pl-2"
            >
              <legend className="mb-1 text-muted text-row">{title}</legend>
              {part.items.map((item, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: an item has no id, and the list only grows or shrinks at an item the user picked.
                <div key={at} className={ROW}>
                  <InputField
                    label={`${title} item ${at + 1}`}
                    labelHidden
                    value={item}
                    onChange={(event) =>
                      change(index, {
                        ...part,
                        items: part.items.map((each, i) => (i === at ? event.target.value : each)),
                      })
                    }
                  />
                  <HomebrewRowRemove
                    name={`item ${at + 1} of ${of}`}
                    onRemove={() =>
                      change(index, { ...part, items: part.items.filter((_, i) => i !== at) })
                    }
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Add an item to ${of}`}
                  onClick={() => change(index, { ...part, items: [...part.items, ""] })}
                  className={ROW_BUTTON}
                >
                  Add an item
                </button>
                {removeButton}
              </div>
            </fieldset>
          );
        }
        if ("rows" in part) {
          return (
            <MonsterRulesTable
              key={part.id}
              part={part}
              title={title}
              of={of}
              onChange={(changed) => change(index, changed)}
              removeButton={removeButton}
            />
          );
        }
        return (
          <fieldset
            key={part.id}
            className="flex min-w-0 flex-col gap-2 border-border border-l-2 pl-2"
          >
            <legend className="mb-1 text-muted text-row">{title}</legend>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <InputField
                  label={`${title} name`}
                  value={part.name}
                  onChange={(event) => change(index, { ...part, name: event.target.value })}
                />
              </div>
              <HomebrewRowMove
                name={of}
                onUp={index > 1 ? () => move(index, index - 2) : undefined}
                onDown={index + 2 < parts.length ? () => move(index, index + 2) : undefined}
              />
            </div>
            <HomebrewRulesText
              label={`${title} rules text`}
              text={part.body}
              onText={(body) => change(index, { ...part, body })}
              rows={3}
            />
            <div className="flex gap-2">{removeButton}</div>
          </fieldset>
        );
      })}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={`Add a list to ${name}`}
          onClick={() => add({ items: [""], stored: { type: "list" } })}
          className={ROW_BUTTON}
        >
          Add a list
        </button>
        <button
          type="button"
          aria-label={`Add a table to ${name}`}
          onClick={() =>
            add({ caption: "", labels: ["", ""], rows: [["", ""]], stored: { type: "table" } })
          }
          className={ROW_BUTTON}
        >
          Add a table
        </button>
        <button
          type="button"
          aria-label={`Add a section to ${name}`}
          onClick={() => add({ name: "", body: "", stored: { type: "entries" } })}
          className={ROW_BUTTON}
        >
          Add a section
        </button>
      </div>
    </div>
  );
}
