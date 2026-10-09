import { type ReactNode, useState } from "react";
import { FormField } from "../../components/FormField.tsx";

export interface HomebrewRulesTextProps {
  label: string;
  /** The text the area opens with; `undefined` where the rules text is more than paragraphs. */
  text: string | undefined;
  onText: (text: string) => void;
  error?: ReactNode;
}

/**
 * Rules text written as paragraphs, a blank line between each. Rules text holding a list,
 * a table or a named section is left to the JSON view, since paragraphs cannot hold it.
 *
 * The area keeps its own text, read once on mount, so a blank line typed between two
 * paragraphs is not trimmed away under the cursor; a parent replacing the entry remounts it.
 */
export function HomebrewRulesText({ label, text, onText, error }: HomebrewRulesTextProps) {
  const [draft, setDraft] = useState(text ?? "");

  if (text === undefined) {
    return (
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
    );
  }
  return (
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
  );
}
