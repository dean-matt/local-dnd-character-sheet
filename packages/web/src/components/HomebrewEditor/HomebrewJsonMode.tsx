import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { FormField } from "../FormField.tsx";
import { HomebrewProblemList } from "./HomebrewProblemList.tsx";
import type { HomebrewProblem } from "./homebrewDraft.ts";
import { JsonEditor, type JsonEditorProps } from "./JsonEditor.tsx";

const TOGGLE =
  "flex shrink-0 items-center gap-1.5 self-start rounded-control px-1.5 py-1 font-semibold text-muted text-row hover:bg-subtle hover:text-ink";

export interface HomebrewJsonModeProps {
  noun: string;
  reference: ReactNode;
  schema: JsonEditorProps["schema"];
  text: string;
  problems: HomebrewProblem[];
  onText: (next: string) => void;
}

/**
 * The entry as JSON text, with the kind's field reference in a sidebar on its left where it
 * has one, as tall as the JSON and scrolling within it. The sidebar collapses sideways to a strip, and the JSON takes the width; where
 * the modal is narrow, it stacks above the JSON and collapses to its button.
 */
export function HomebrewJsonMode({
  noun,
  reference,
  schema,
  text,
  problems,
  onText,
}: HomebrewJsonModeProps) {
  const id = useId();
  const [open, setOpen] = useState(true);
  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @2xl:grid @2xl:grid-cols-[auto_minmax(0,1fr)] @2xl:items-start">
        {reference &&
          (open ? (
            <section
              aria-labelledby={`${id}-heading`}
              className="flex min-w-0 flex-col gap-2 @2xl:h-0 @2xl:min-h-full @2xl:w-80 @2xl:overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 id={`${id}-heading`} className="font-semibold text-row">
                  Field Reference
                </h3>
                <button
                  type="button"
                  aria-expanded
                  title="Hide field reference"
                  onClick={() => setOpen(false)}
                  className={TOGGLE}
                >
                  <PanelLeftClose aria-hidden size={16} />
                  <span className="sr-only">Hide field reference</span>
                </button>
              </div>
              {reference}
            </section>
          ) : (
            <button
              type="button"
              aria-expanded={false}
              title="Show field reference"
              onClick={() => setOpen(true)}
              className={`${TOGGLE} @2xl:flex-col @2xl:py-2`}
            >
              <PanelLeftOpen aria-hidden size={16} />
              <span className="sr-only">Show field reference</span>
              <span aria-hidden className="@2xl:[writing-mode:vertical-rl]">
                Field Reference
              </span>
            </button>
          ))}
        <div className="flex min-w-0 flex-1 flex-col">
          <FormField
            label={`${noun} JSON`}
            status="Tab indents. Press Esc, then Tab, to leave the editor."
            error={problems.length > 0 && <HomebrewProblemList problems={problems} />}
          >
            {(control) => (
              <JsonEditor {...control} value={text} onChange={onText} schema={schema} />
            )}
          </FormField>
        </div>
      </div>
    </div>
  );
}
