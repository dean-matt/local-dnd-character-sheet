import type { Derived } from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { InputField } from "../InputField.tsx";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

export interface EditableFieldProps<T> {
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

const DEFAULT_DEBOUNCE_MS = 500;

export function EditableField<T>({
  label,
  format,
  schema,
  parse,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  current,
}: EditableFieldProps<T> & { current: T }) {
  const initial = format(current);
  // Read once: `text` never resyncs to a later `value` prop change. No caller
  // remounts a mounted edit field with a new value yet, so there is no live case
  // to settle a resync policy against — M5's first edit caller decides it.
  const [text, setText] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The text behind the last write that actually landed, seeded with the field's
  // own starting text. `commit` skips only a raw value equal to this — never a
  // check against `status`, which a keystroke resets on every change and so
  // cannot reliably say whether the current text was ever saved.
  const savedText = useRef<string>(initial);
  const queue = useRef(Promise.resolve());

  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule(raw: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(raw), debounceMs);
  }

  async function commit(raw: string) {
    clearTimeout(timer.current);
    if (raw === savedText.current) return;

    if (raw.trim() === "") {
      await save(raw, null);
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
    await save(raw, result.data);
  }

  // Chained on `queue` rather than fired directly: a commit that lands while a
  // prior save is still in flight waits for it, so the status shown always
  // reflects the most recently attempted write rather than whichever settles first.
  async function save(raw: string, next: T | null) {
    const run = async () => {
      setStatus("saving");
      setError(undefined);
      try {
        await onSave(next);
        savedText.current = raw;
        setStatus("saved");
      } catch (err) {
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    };
    queue.current = queue.current.then(run);
    await queue.current;
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
    <InputField
      label={label}
      type="text"
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      status={status === "saving" ? "Saving…" : status === "saved" ? "Saved" : undefined}
      error={
        status === "failed" ? (
          <>
            {error ?? "Save failed."}
            <button type="button" onClick={retry} className="underline">
              Retry
            </button>
          </>
        ) : undefined
      }
    />
  );
}
