import { type ReactNode, useEffect, useRef, useState } from "react";
import { InputField } from "../../components/InputField.tsx";

export interface TypedEscapeProps {
  /** What is typed, such as `race`, which names the link and the field. */
  noun: string;
  onUse: (name: string) => void;
  /** Whatever else the typed row needs before it can be used, such as a hit die. */
  canUse?: boolean;
  error?: string;
  /** Fields beyond the name, between it and Use. */
  children?: ReactNode;
}

/**
 * The way past the catalog: a row typed by name, for one the picker does not offer. Opening
 * it moves focus to the name, where the link it replaced held it.
 */
export function TypedEscape({ noun, onUse, canUse = true, error, children }: TypedEscapeProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit font-semibold text-accent-text text-row"
      >
        Not listed? Type a {noun}
      </button>
    );
  }
  const typed = name.trim();
  const ready = typed !== "" && canUse;
  return (
    <div className="flex flex-col gap-1">
      <InputField
        ref={input}
        label={`${noun[0]?.toUpperCase()}${noun.slice(1)} name`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          // Enter would submit the whole flow; here it uses the typed name.
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (ready) onUse(typed);
        }}
      />
      {children}
      <button
        type="button"
        disabled={!ready}
        onClick={() => onUse(typed)}
        className="mt-1 w-fit rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body disabled:opacity-60"
      >
        Use
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </div>
  );
}
