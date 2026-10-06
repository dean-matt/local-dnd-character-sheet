import { type Derived, derivedValue } from "@dnd/character";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { useFleeting } from "../../hooks/useFleeting.ts";
import type { FormFieldProps } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { SaveFailure } from "../SaveFailure.tsx";

/** `invalid` is text the parse or schema refused, which a retry would refuse again;
 * `failed` is a write that did not land, which a retry can. */
type SaveStatus = "idle" | "saving" | "saved" | "invalid" | "failed";

/**
 * `Field`'s edit state. A derived `value` writes its manual half, and clearing it saves
 * `null`, which drops the override. A plain `current` value is the definition's own: an
 * empty input goes through `parse` and `schema` like any other text, so the schema refuses
 * it on the field.
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
  inputMode?: ComponentProps<"input">["inputMode"];
  placeholder?: string;
  messageSlot?: FormFieldProps["messageSlot"];
} & (
  | { value: Derived<T>; onSave: (next: T | null) => Promise<void> }
  | { current: T; onSave: (next: T) => Promise<void> }
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
    inputMode,
    placeholder,
    messageSlot,
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
  // How the last save reads back once formatted: "Vex " saves as "Vex", and that echo
  // must not replace the text the user is still typing.
  const echo = useRef<string | undefined>(undefined);
  const textRef = useRef(text);
  const queue = useRef(Promise.resolve());
  const showSaved = useFleeting(status === "saved");

  useEffect(() => () => clearTimeout(timer.current), []);

  // A value set from outside the field, such as by undo, replaces the text only while
  // the field holds no unsaved edit: the user's own typing outranks it.
  useEffect(() => {
    if (incoming === savedText.current || incoming === echo.current) return;
    if (textRef.current !== savedText.current) return;
    echo.current = undefined;
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

    if (raw.trim() === "" && "value" in props) {
      const { onSave } = props;
      await save(raw, undefined, () => onSave(null));
      return;
    }

    let parsed: T;
    try {
      parsed = parse(raw);
    } catch {
      setStatus("invalid");
      setError("Not a valid value.");
      return;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      setStatus("invalid");
      setError(result.error.issues[0]?.message ?? "Invalid value.");
      return;
    }
    const { onSave } = props;
    await save(raw, format(result.data), () => onSave(result.data));
  }

  // Chained on `queue` rather than fired directly: a commit that lands while a
  // prior save is still in flight waits for it, so the status shown always
  // reflects the most recently attempted write rather than whichever settles first.
  async function save(raw: string, formatted: string | undefined, write: () => Promise<void>) {
    const run = async () => {
      setStatus("saving");
      setError(undefined);
      try {
        await write();
        savedText.current = raw;
        echo.current = formatted;
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
      inputMode={inputMode}
      placeholder={placeholder}
      messageSlot={messageSlot}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      status={status === "saving" ? "Saving…" : showSaved ? "Saved" : undefined}
      error={
        status === "invalid" ? (
          error
        ) : status === "failed" ? (
          <SaveFailure message={error ?? "Save failed."} onRetry={retry} />
        ) : undefined
      }
    />
  );
}
