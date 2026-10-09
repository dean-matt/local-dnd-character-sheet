import type { Entries } from "@dnd/catalog";
import { type ReactNode, useId, useState } from "react";
import { FormField } from "../../components/FormField.tsx";
import { RulesEntries } from "../../components/RulesEntries/RulesEntries.tsx";
import { useDebounce } from "../../hooks/useDebounce.ts";

/** Long enough that a burst of typing resolves its references once, not per keystroke. */
const PREVIEW_DELAY_MS = 400;

export interface HomebrewRulesTextProps {
  label: string;
  /** The text the area opens with; `undefined` where the rules text is more than paragraphs. */
  text: string | undefined;
  onText: (text: string) => void;
  /** What the preview renders: the entries the text writes, as the entry now holds them. */
  preview: Entries | undefined;
  error?: ReactNode;
}

/**
 * Rules text written as paragraphs, a blank line between each, with the `{@tag}` preview
 * beside it as the sheet renders it. Rules text holding a list, a table or a named section
 * is previewed but left to the JSON view, since paragraphs cannot hold it.
 *
 * The area keeps its own text, read once on mount, so a blank line typed between two
 * paragraphs is not trimmed away under the cursor; a parent replacing the entry remounts it.
 */
export function HomebrewRulesText({ label, text, onText, preview, error }: HomebrewRulesTextProps) {
  const [draft, setDraft] = useState(text ?? "");
  const settled = useDebounce(preview, PREVIEW_DELAY_MS);
  const id = useId();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {text === undefined ? (
        <div className="flex flex-col">
          <span className="mb-1 text-muted text-row">{label}</span>
          <p className="text-muted text-row">
            This text holds a list, a table or a named section. Edit it as JSON.
          </p>
          {error && (
            <span role="alert" className="mt-1 text-error text-row">
              {error}
            </span>
          )}
        </div>
      ) : (
        <FormField label={label} error={error}>
          {(control) => (
            <textarea
              {...control}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                onText(event.target.value);
              }}
              rows={8}
              className="resize-y rounded-control border border-border bg-surface px-2 py-1 text-row aria-invalid:border-error"
            />
          )}
        </FormField>
      )}
      <section aria-labelledby={`${id}-preview`} className="flex flex-col">
        <h4 id={`${id}-preview`} className="mb-1 text-muted text-row">
          {`${label} preview`}
        </h4>
        <div className="flex-1 rounded-control border border-border bg-surface p-3 text-body">
          {settled && settled.length > 0 ? (
            <RulesEntries entries={settled} headingLevel={5} />
          ) : (
            <p className="text-muted">Nothing written yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
