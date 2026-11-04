import { useRef, useState } from "react";
import { InputField } from "../InputField.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import { ROW, ROW_BUTTON } from "./homebrewRows.ts";
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

/**
 * A row's rules text: paragraphs, then each list with its items one to a line and the paragraphs
 * after it. A blank item or paragraph stays on screen but writes nothing.
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
  const lists = parts.length > 1;
  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, index) => {
        const list = Math.ceil(index / 2);
        if ("text" in part) {
          return (
            <HomebrewRulesText
              key={part.id}
              label={index === 0 ? `${label} rules text` : `${label} rules text after list ${list}`}
              text={part.text}
              onText={(text) => change(index, { text })}
              rows={lists ? 3 : 8}
            />
          );
        }
        const of = `list ${list} of ${name}`;
        const before = parts[index - 1];
        const after = parts[index + 1];
        return (
          <fieldset
            key={part.id}
            className="flex min-w-0 flex-col gap-2 border-border border-l-2 pl-2"
          >
            <legend className="mb-1 text-muted text-row">{`${label} list ${list}`}</legend>
            {part.items.map((item, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: an item has no id, and the list only grows or shrinks at an item the user picked.
              <div key={at} className={ROW}>
                <InputField
                  label={`${label} list ${list} item ${at + 1}`}
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
              <button
                type="button"
                aria-label={`Remove ${of}`}
                onClick={() =>
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
                  ])
                }
                className={ROW_BUTTON}
              >
                Remove list
              </button>
            </div>
          </fieldset>
        );
      })}
      <button
        type="button"
        aria-label={`Add a list to ${name}`}
        onClick={() =>
          write([
            ...parts,
            { items: [""], stored: { type: "list" }, id: next.current++ },
            { text: "", id: next.current++ },
          ])
        }
        className={`self-start ${ROW_BUTTON}`}
      >
        Add a list
      </button>
    </div>
  );
}
