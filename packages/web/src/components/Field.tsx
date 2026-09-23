/**
 * The one component every read and edit view renders a value through, so turning
 * editing on later means passing `mode="edit"` rather than rewriting the view.
 *
 * A value is `manual ?? computed` — `packages/character`'s `Derived<T>` shape.
 * Read mode only shows that value. Edit mode commits on a debounce and on blur,
 * writes `manual` only, and clearing the input reverts to `computed` rather than
 * a parsed empty value: `onSave` receives `null`, never a zero or an empty
 * string. A save's `saving`, `saved` and `failed` status renders beside the
 * field; `failed` keeps the user's text and offers a retry, so a failed write
 * never looks like it went through.
 *
 * Autosave has no confirm step, so the only way back from a bad edit is undo —
 * which is why undo ships alongside editing rather than waiting for play state.
 */
import { type Derived, derivedValue } from "@dnd/character";
import { useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

interface ReadFieldProps<T> {
  mode: "read";
  label: string;
  value: Derived<T>;
  format: (value: T) => string;
}

interface EditFieldProps<T> {
  mode: "edit";
  label: string;
  value: Derived<T>;
  format: (value: T) => string;
  schema: z.ZodType<T>;
  parse: (raw: string) => T;
  onSave: (next: T | null) => Promise<void>;
  /** Idle time after the last keystroke before a commit fires. Tests lower this. */
  debounceMs?: number;
}

export type FieldProps<T> = ReadFieldProps<T> | EditFieldProps<T>;

const DEFAULT_DEBOUNCE_MS = 500;

export function Field<T>(props: FieldProps<T>) {
  const current = derivedValue(props.value);

  if (props.mode === "read") {
    return (
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted text-row">{props.label}</span>
        <span className="font-medium">{props.format(current)}</span>
      </div>
    );
  }

  return <EditableField {...props} current={current} />;
}

function EditableField<T>({
  label,
  format,
  schema,
  parse,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  current,
}: EditFieldProps<T> & { current: T }) {
  const id = useId();
  const [text, setText] = useState(format(current));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const attempted = useRef<string | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule(raw: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(raw), debounceMs);
  }

  async function commit(raw: string) {
    clearTimeout(timer.current);
    if (raw === attempted.current && status !== "failed") return;
    attempted.current = raw;

    if (raw.trim() === "") {
      await save(null);
      return;
    }

    let parsed: T;
    try {
      parsed = parse(raw);
    } catch {
      setStatus("failed");
      setError("Not a valid value.");
      return;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      setStatus("failed");
      setError(result.error.issues[0]?.message ?? "Invalid value.");
      return;
    }
    await save(result.data);
  }

  async function save(next: T | null) {
    setStatus("saving");
    setError(undefined);
    try {
      await onSave(next);
      setStatus("saved");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  function handleChange(next: string) {
    setText(next);
    setStatus("idle");
    schedule(next);
  }

  function handleBlur() {
    commit(text);
  }

  function retry() {
    commit(text);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted text-row">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        className="rounded-card border border-border bg-surface px-2 py-1"
      />
      {status === "saving" && (
        <span role="status" aria-live="polite" className="text-muted text-row">
          Saving…
        </span>
      )}
      {status === "saved" && (
        <span role="status" aria-live="polite" className="text-muted text-row">
          Saved
        </span>
      )}
      {status === "failed" && (
        <span role="alert" className="flex items-center gap-2 text-row">
          {error ?? "Save failed."}
          <button type="button" onClick={retry} className="underline">
            Retry
          </button>
        </span>
      )}
    </div>
  );
}
