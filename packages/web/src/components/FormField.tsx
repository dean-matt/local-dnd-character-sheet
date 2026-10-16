/**
 * The chrome every form control renders inside: the label above it, a status line and an
 * error message below it, and the `id` and `aria-describedby` that tie the three to the
 * control. `FormField` takes any control through its render prop; `InputField.tsx` holds the
 * native `<input>` case, which most call sites want.
 *
 * The error reaches a screen reader through `aria-describedby` and a `role="alert"`
 * region, never a native validation bubble, so a `<form>` holding these sets `noValidate`.
 * A control rendered outside `FormField` wires its own `aria-describedby`. The label's id is
 * the control's id with `-label`, for a control no `<label for>` names, such as a
 * `contenteditable`.
 *
 * `messageSlot` moves the status and error out of the field into an element the caller
 * places, for a control too narrow to hold a sentence. Given a `name`, it names the field in
 * each, so one slot can hold several fields' messages.
 *
 * `invalid` marks the control without a message, for a field whose problem a save toast
 * reports instead.
 */
import { type ReactNode, useId } from "react";
import { createPortal } from "react-dom";

/** What `FormField` hands its control to spread onto the focusable element. */
interface ControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

export interface FormFieldProps {
  label: string;
  /** Keeps the label for a screen reader where the surrounding layout already names the control. */
  labelHidden?: boolean;
  /** Marks the control invalid and describes it. */
  error?: ReactNode;
  invalid?: boolean;
  /** Progress the user should hear without moving focus, such as a save in flight. */
  status?: ReactNode;
  /** The id of an element the caller renders that describes the control, such as a hint. */
  describedBy?: string;
  /** `into` is null until the caller's element mounts; nothing renders until then. */
  messageSlot?: { into: Element | null; name?: string };
  children: (control: ControlProps) => ReactNode;
}

export function FormField({
  label,
  labelHidden,
  error,
  invalid: marked = false,
  status,
  describedBy,
  messageSlot,
  children,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  // Truthiness, so `error={touched && message}` reads its `false` as valid.
  const invalid = Boolean(error);
  const named = (message: ReactNode) =>
    messageSlot?.name && message ? (
      <>
        {`${messageSlot.name}: `}
        {message}
      </>
    ) : (
      message
    );
  const messages = (
    <>
      {/* Rendered and left in the accessibility tree while empty: a live region added with
          its text is often not announced. A margin rather than the parent's gap spaces it, so
          an empty one takes no room. */}
      <span role="status" aria-live="polite" className="mt-1 text-muted text-row empty:mt-0">
        {invalid ? null : named(status)}
      </span>
      {invalid && (
        <span
          id={errorId}
          role="alert"
          className="mt-1 flex items-center gap-2 text-error text-row"
        >
          {named(error)}
        </span>
      )}
    </>
  );

  return (
    <div className="flex flex-col">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={labelHidden ? "sr-only" : "mb-1 text-muted text-row"}
      >
        {label}
      </label>
      {children({
        id,
        "aria-invalid": invalid || marked,
        "aria-describedby":
          [describedBy, invalid && errorId].filter(Boolean).join(" ") || undefined,
      })}
      {messageSlot ? messageSlot.into && createPortal(messages, messageSlot.into) : messages}
    </div>
  );
}
