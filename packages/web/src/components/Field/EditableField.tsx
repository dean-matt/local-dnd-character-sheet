import { type Derived, derivedValue } from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { InputField } from "../InputField.tsx";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

/**
 * `Field`'s edit state. A derived `value` writes its manual half, and clearing it saves
 * `null`, which drops the override. A plain `current` value is the definition's own:
 * `required` sends an empty input through `parse` and `schema` like any other text, so the
 * schema refuses it on the field; without it, clearing saves `null`.
 */
export type EditableFieldProps<T> = {
  mode: "edit";
  label: string;
  format: (value: T) => string;
  schema: z.ZodType<T>;
  parse: (raw: string) => T;
  /** Idle time after the last keystroke before a commit fires. Tests lower this. */
  debounceMs?: number;
  labelHidden?: boolean;
  inputClassName?: string;
  /** A `<datalist>` id: suggestions the input offers without restricting it to them. */
  list?: string;
  placeholder?: string;
} & (
  | { value: Derived<T>; required?: never; onSave: (next: T | null) => Promise<void> }
  | { current: T; required: true; onSave: (next: T) => Promise<void> }
  | { current: T; required?: false; onSave: (next: T | null) => Promise<void> }
);

const DEFAULT_DEBOUNCE_MS = 500;

export function EditableField<T>(props: EditableFieldProps<T>) {
  const {
    label,
    format,
    schema,
    parse,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    labelHidden,
    inputClassName,
    list,
    placeholder,
  } = props;
  const current = "current" in props ? props.current : derivedValue(props.value);
  const incoming = format(current);
  const [text, setText] = useState(incoming);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The text behind the last write that actually landed, seeded with the field's
  // own starting text. `commit` skips only a raw value equal to this — never a
  // check against `status`, which a keystroke resets on every change and so
  // cannot reliably say whether the current text was ever saved.
  const savedText = useRef<string>(incoming);
  const textRef = useRef(text);
  const queue = useRef(Promise.resolve());

  useEffect(() => () => clearTimeout(timer.current), []);

  // A value set from outside the field, such as by undo, replaces the text only while
  // the field holds no unsaved edit: the user's own typing outranks it.
  useEffect(() => {
    if (incoming === savedText.current || textRef.current !== savedText.current) return;
    savedText.current = incoming;
    textRef.current = incoming;
    setText(incoming);
    setStatus("idle");
    setError(undefined);
  }, [incoming]);

  function schedule(raw: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(raw), debounceMs);
  }

  async function commit(raw: string) {
    clearTimeout(timer.current);
    if (raw === savedText.current) return;

    if (raw.trim() === "" && !props.required) {
      const { onSave } = props;
      await save(raw, () => onSave(null));
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
    const { onSave } = props;
    await save(raw, () => onSave(result.data));
  }

  // Chained on `queue` rather than fired directly: a commit that lands while a
  // prior save is still in flight waits for it, so the status shown always
  // reflects the most recently attempted write rather than whichever settles first.
  async function save(raw: string, write: () => Promise<void>) {
    const run = async () => {
      setStatus("saving");
      setError(undefined);
      try {
        await write();
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
    textRef.current = next;
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
      labelHidden={labelHidden}
      className={inputClassName}
      type="text"
      list={list}
      placeholder={placeholder}
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
