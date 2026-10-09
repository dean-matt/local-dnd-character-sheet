import type { CharacterRecord } from "@dnd/character";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { capitalize } from "../../components/blocks/capitalize.ts";
import { FormField } from "../../components/FormField.tsx";
import { Select } from "../../components/Select.tsx";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import { HomebrewPreview } from "./HomebrewPreview.tsx";
import { HomebrewViewTabs, type HomebrewViewTabsProps } from "./HomebrewViewTabs.tsx";
import {
  checkHomebrewEntry,
  type HomebrewDraft,
  type HomebrewEntry,
  type HomebrewProblem,
  parseHomebrewEntry,
} from "./homebrewDraft.ts";
import { FORM_GRID, SHORT } from "./homebrewGrid.ts";
import type { HomebrewInput, HomebrewKind, HomebrewRow } from "./homebrewKinds.ts";

type Edition = CharacterRecord["edition"];

const EDITIONS = Object.entries(EDITION_LABELS).map(([value, label]) => ({ value, label }));
const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

/** Long enough that a burst of typing resolves the preview's references once, not per keystroke. */
const PREVIEW_DELAY_MS = 400;

/** The entry as a user edits it, without the `source` the server stamps. */
function editable(entry: Record<string, unknown>): HomebrewEntry {
  const { source: _source, ...rest } = entry;
  return rest;
}

const asText = (entry: HomebrewEntry) => JSON.stringify(entry, null, 2);

/**
 * The preview of the last entry the schema accepted, once edits have held still. An entry
 * that fails to parse keeps the one before it showing, even one accepted a moment earlier.
 */
function useLastValid(kind: HomebrewKind, draft: HomebrewDraft<HomebrewInput>) {
  const valid = "input" in draft ? draft.input : undefined;
  const [lastValid, setLastValid] = useState(valid);
  if (valid && valid !== lastValid) setLastValid(valid);
  const settled = useDebounce(lastValid, PREVIEW_DELAY_MS);
  return useMemo(() => settled && { input: settled, facts: kind.facts(settled) }, [settled, kind]);
}

const problemList = (problems: HomebrewProblem[]) => (
  <ul className="flex flex-col gap-0.5">
    {problems.map(({ field, message }) => (
      <li key={`${field}: ${message}`}>{`${field}: ${message}`}</li>
    ))}
  </ul>
);

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
 * A homebrew entry edited through its kind's form, or as the 5etools-shaped JSON it is
 * stored as, with its edition beside it. Both views edit one entry, so a change in either
 * shows in the other and a field the form has no control for survives it. The JSON view
 * takes a pasted entry whole; leaving it waits until the text parses. Each problem shows
 * beside its field once a save is tried. Saving replaces the whole entry.
 *
 * One preview shows the last entry the schema accepted, beside the form where the editor
 * is wide enough and behind an Edit / Preview tab where it is not.
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
  const [entry, setEntry] = useState(() => editable(record ? record.json : starter.entry));
  /** Set while the JSON view is open: the text as typed, which may not parse yet. */
  const [text, setText] = useState<string>();
  /** Bumped when the entry is replaced whole, so the form's own text areas reread it. */
  const [revision, setRevision] = useState(0);
  const [edition, setEdition] = useState<Edition>(record?.edition ?? "one");
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // The editor mounts below the whole list, so a keyboard user would otherwise tab past it.
  useEffect(() => {
    form.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, []);
  const id = useId();
  const parsed = useMemo(
    () => (text === undefined ? { entry } : parseHomebrewEntry(text)),
    [text, entry],
  );
  const draft = useMemo(
    () =>
      "entry" in parsed ? checkHomebrewEntry(parsed.entry, edition, kind.inputSchema) : parsed,
    [parsed, edition, kind],
  );
  const shown = useLastValid(kind, draft);
  const [view, setView] = useState<HomebrewViewTabsProps["view"]>("Edit");
  const problems = tried && "problems" in draft ? draft.problems : [];
  const unplaced =
    text === undefined ? problems.filter(({ key }) => !kind.formKeys.includes(key)) : problems;
  const title = record ? `Edit ${record.name}` : `New ${kind.noun}`;
  const noun = capitalize(kind.noun);

  const replace = (next: HomebrewEntry) => {
    setEntry(next);
    setRevision((count) => count + 1);
    if (text !== undefined) setText(asText(next));
  };

  return (
    <form
      ref={form}
      aria-labelledby={`${id}-title`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if ("input" in draft && !saving) onSave(draft.input);
        else setView("Edit");
      }}
      className="@container flex flex-col gap-3 border-border border-t pt-3"
    >
      <h3 id={`${id}-title`} className="font-semibold text-sm">
        {title}
      </h3>
      <p className="text-label text-muted">
        {record ? `Edit the ${kind.noun}` : `Edit this example ${kind.noun}`}, or switch to JSON to
        paste a 5etools-shaped one over it. Saving replaces the whole entry, and the source is
        always Homebrew.
      </p>
      <HomebrewViewTabs label={`${noun} view`} idPrefix={id} view={view} onView={setView} />
      <div className="flex flex-col gap-3 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @3xl:items-start @3xl:gap-6">
        <div
          id={`${id}-Edit`}
          role="tabpanel"
          aria-labelledby={`${id}-Edit-tab`}
          className={`@container min-w-0 flex-col gap-3 ${view === "Edit" ? "flex" : "hidden @3xl:flex"}`}
        >
          <div className={FORM_GRID}>
            <div className={SHORT}>
              <FormField label="Rules">
                {(control) => (
                  <Select
                    {...control}
                    options={EDITIONS}
                    value={edition}
                    onChange={(next) => {
                      setEdition(next as Edition);
                      const renamed =
                        "entry" in parsed && kind.forEdition?.(parsed.entry, next as Edition);
                      if (renamed && renamed !== parsed.entry) replace(renamed);
                    }}
                  />
                )}
              </FormField>
            </div>
            {!record && kind.starters.length > 1 && (
              <div className={SHORT}>
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
                        replace(editable(picked.entry));
                      }}
                    />
                  )}
                </FormField>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (text === undefined) return setText(asText(entry));
                if ("entry" in parsed) {
                  replace(parsed.entry);
                  setText(undefined);
                } else setTried(true);
              }}
              className={`${BUTTON} col-span-2 -col-end-1 self-end justify-self-end border border-border bg-surface text-ink hover:bg-subtle`}
            >
              {text === undefined ? "Edit as JSON" : "Edit as form"}
            </button>
          </div>
          {text === undefined ? (
            <kind.Form
              key={revision}
              entry={entry}
              edition={edition}
              onChange={setEntry}
              errorFor={(key) => {
                const own = problems.filter((problem) => problem.key === key);
                if (own.length === 0) return undefined;
                return own
                  .map(({ field, message }) => (field === key ? message : `${field}: ${message}`))
                  .join("; ");
              }}
            />
          ) : (
            <FormField label={`${noun} JSON`} error={unplaced.length > 0 && problemList(unplaced)}>
              {(control) => (
                <textarea
                  {...control}
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    const read = parseHomebrewEntry(event.target.value);
                    if ("entry" in read) setEntry(read.entry);
                  }}
                  spellCheck={false}
                  rows={16}
                  className="resize-y rounded-control border border-border bg-surface px-2 py-1 font-mono text-row aria-invalid:border-error"
                />
              )}
            </FormField>
          )}
          {text === undefined && unplaced.length > 0 && (
            <div role="alert" className="text-error text-row">
              {problemList(unplaced)}
            </div>
          )}
        </div>
        <div
          id={`${id}-Preview`}
          role="tabpanel"
          aria-labelledby={`${id}-Preview-tab`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll container takes focus so the keyboard can scroll it.
          tabIndex={0}
          className={`min-w-0 rounded-control border border-border bg-surface p-4 @3xl:sticky @3xl:top-[calc(var(--spacing-topbar)+1rem)] @3xl:block @3xl:max-h-[calc(100dvh-var(--spacing-topbar)-2rem)] @3xl:overflow-auto ${view === "Preview" ? "block" : "hidden"}`}
        >
          <HomebrewPreview noun={kind.noun} shown={shown} />
        </div>
      </div>
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
