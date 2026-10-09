import type { CharacterRecord } from "@dnd/character";
import { useEffect, useId, useRef, useState } from "react";
import { FormField } from "../../components/FormField.tsx";
import { RulesEntries } from "../../components/RulesEntries/RulesEntries.tsx";
import { Select } from "../../components/Select.tsx";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import { readHomebrewDraft } from "./homebrewDraft.ts";
import type { HomebrewKind, HomebrewRow } from "./homebrewKinds.ts";

type Edition = CharacterRecord["edition"];

const EDITIONS = Object.entries(EDITION_LABELS).map(([value, label]) => ({ value, label }));
const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";
/** Long enough that a burst of typing resolves its references once, not per keystroke. */
const PREVIEW_DELAY_MS = 400;

/** The entry as a user edits it: pretty-printed, without the `source` the server stamps. */
function editableText(entry: Record<string, unknown>): string {
  const { source: _source, ...rest } = entry;
  return JSON.stringify(rest, null, 2);
}

export interface HomebrewEditorProps {
  kind: HomebrewKind;
  /** The row being replaced; absent for a new one. */
  record: HomebrewRow | undefined;
  saving: boolean;
  /** Why the last save failed, such as a name another row holds. */
  failure: string | undefined;
  onSave: (input: unknown) => void;
  onCancel: () => void;
}

/**
 * A homebrew entry pasted or typed as 5etools-shaped JSON, with its edition beside it. Each
 * problem names its field, and the rules text previews as the sheet renders it once the
 * entry holds together. Saving replaces the whole entry.
 */
export function HomebrewEditor({
  kind,
  record,
  saving,
  failure,
  onSave,
  onCancel,
}: HomebrewEditorProps) {
  const [starter, setStarter] = useState(kind.starters[0]);
  const [text, setText] = useState(() =>
    editableText(record ? (record.json as Record<string, unknown>) : starter.entry),
  );
  const [edition, setEdition] = useState<Edition>(record?.edition ?? "one");
  const [tried, setTried] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // The editor mounts below the whole list, so a keyboard user would otherwise tab past it.
  useEffect(() => {
    box.current?.focus();
  }, []);
  const id = useId();
  const draft = readHomebrewDraft(text, edition, kind.inputSchema);
  const settled = readHomebrewDraft(useDebounce(text, PREVIEW_DELAY_MS), edition, kind.inputSchema);
  const entries =
    "input" in settled
      ? (settled.input as { entries?: HomebrewRow["json"]["entries"] }).entries
      : undefined;
  const title = record ? `Edit ${record.name}` : `New ${kind.noun}`;

  return (
    <form
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if ("input" in draft && !saving) onSave(draft.input);
      }}
      className="flex flex-col gap-3 border-border border-t pt-3"
    >
      <h3 id={`${id}-title`} className="font-semibold text-sm">
        {title}
      </h3>
      <p className="text-label text-muted">
        {record
          ? `Edit the ${kind.noun}'s 5etools-shaped entry.`
          : `Edit this example ${kind.noun}, or paste a 5etools-shaped one over it.`}{" "}
        Saving replaces the whole entry, and the source is always Homebrew.
      </p>
      <div className="flex gap-3">
        <div className="w-32">
          <FormField label="Rules">
            {(control) => (
              <Select
                {...control}
                options={EDITIONS}
                value={edition}
                onChange={(next) => setEdition(next as Edition)}
              />
            )}
          </FormField>
        </div>
        {!record && kind.starters.length > 1 && (
          <div className="w-32">
            <FormField label="Start from">
              {(control) => (
                <Select
                  {...control}
                  options={kind.starters.map(({ label }) => ({ value: label, label }))}
                  value={starter.label}
                  onChange={(next) => {
                    const picked = kind.starters.find(({ label }) => label === next);
                    if (!picked) return;
                    setStarter(picked);
                    setText(editableText(picked.entry));
                  }}
                />
              )}
            </FormField>
          </div>
        )}
      </div>
      <FormField
        label={`${kind.noun.charAt(0).toUpperCase()}${kind.noun.slice(1)} JSON`}
        error={
          tried &&
          "problems" in draft && (
            <ul className="flex flex-col gap-0.5">
              {draft.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )
        }
      >
        {(control) => (
          <textarea
            {...control}
            ref={box}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={12}
            className="resize-y rounded-control border border-border bg-surface px-2 py-1 font-mono text-row aria-invalid:border-error"
          />
        )}
      </FormField>
      <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-1.5">
        <h4 id={`${id}-preview`} className="text-muted text-row">
          Preview
        </h4>
        <div className="rounded-control border border-border bg-surface p-3 text-body">
          {entries && entries.length > 0 ? (
            <RulesEntries entries={entries} headingLevel={5} />
          ) : (
            <p className="text-muted">
              {"input" in settled
                ? "This entry carries no rules text."
                : "The rules text shows here once the entry holds together."}
            </p>
          )}
        </div>
      </section>
      <div className="flex items-center justify-end gap-2">
        <p role="alert" className="mr-auto text-error text-row">
          {failure && `Save failed: ${failure}`}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
        >
          Cancel
        </button>
        <button
          type="submit"
          aria-disabled={saving}
          className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
