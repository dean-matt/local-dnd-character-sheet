import { type Derived, derivedValue } from "@dnd/character";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { useSaveToast } from "../../hooks/useSaveToast.ts";
import { raiseSaveToast } from "../../lib/saveToasts.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";

/** `invalid` is text the parse or schema refused, which a retry would refuse again;
 * `failed` is a write that did not land, which a retry can. */
type SaveStatus = "idle" | "invalid" | "failed";

/**
 * `Field`'s edit state. A derived `value` writes its manual half, and clearing it saves
 * `null`, which drops the override. A plain `current` value is the definition's own: an
 * empty input goes through `parse` and `schema` like any other text, so the schema decides
 * whether it saves.
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
  /** A text area rather than a one-line input, for prose whose line breaks the value keeps. */
  multiline?: boolean;
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
    multiline,
  } = props;
  const current = "current" in props ? props.current : derivedValue(props.value);
  const incoming = format(current);
  const [text, setText] = useState(incoming);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  // Counts failed writes, so a repeat of one the user dismissed raises its toast again.
  const [failures, setFailures] = useState(0);
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

  // The text of the latest write handed to `queue`, so an unmount does not send it twice.
  const queued = useRef<string | undefined>(undefined);
  const flush = useRef(() => {});
  flush.current = () => {
    const raw = textRef.current;
    if (raw !== savedText.current && raw !== queued.current) commit(raw);
  };
  // A field can unmount mid-edit, as one in a modal does when Escape closes it, with no
  // blur to commit the text; saving it here keeps the edit rather than dropping it. With
  // no field left to outline or retry, refused text is dropped and a failed write raises a
  // toast without a retry.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      flush.current();
    };
  }, []);

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
  // prior save is still in flight waits for it, so the problem shown always
  // reflects the most recently attempted write rather than whichever settles first.
  async function save(raw: string, formatted: string | undefined, write: () => Promise<void>) {
    // A failure stands while its retry is in flight, so its toast goes only once one lands.
    const run = async () => {
      try {
        await write();
        savedText.current = raw;
        echo.current = formatted;
        setStatus("idle");
        setError(undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed.";
        if (!mounted.current) raiseSaveToast({ id: toastId, field: label, message });
        setStatus("failed");
        setError(message);
        setFailures((count) => count + 1);
      }
    };
    queued.current = raw;
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

  const toastId = useSaveToast(
    label,
    status === "invalid" || status === "failed" ? (error ?? "Save failed.") : undefined,
    status === "failed" ? () => commit(textRef.current) : undefined,
    failures,
  );

  const invalid = status === "invalid" || status === "failed";
  if (multiline) {
    return (
      <FormField label={label} labelHidden={labelHidden} invalid={invalid}>
        {(control) => (
          <textarea
            {...control}
            className={`control min-h-16 resize-y ${inputClassName ?? ""}`}
            placeholder={placeholder}
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
          />
        )}
      </FormField>
    );
  }
  return (
    <InputField
      label={label}
      labelHidden={labelHidden}
      className={inputClassName}
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      invalid={invalid}
    />
  );
}
