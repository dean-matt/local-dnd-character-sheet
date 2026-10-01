/**
 * The chrome every form control renders inside: the label above it, a status line and an
 * error message below it, and the `id` and `aria-describedby` that tie the three to the
 * control. `FormField` takes any control through its render prop; `InputField` is the
 * native `<input>` case, which most call sites want.
 *
 * The error reaches a screen reader through `aria-describedby` and a `role="alert"`
 * region, never a native validation bubble, so a `<form>` holding these sets `noValidate`.
 * A control rendered outside `FormField` wires its own `aria-describedby`.
 */
import { type ComponentProps, type ReactNode, useId } from "react";

/** What `FormField` hands its control to spread onto the focusable element. */
interface ControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

interface ChromeProps {
  label: string;
  /** Marks the control invalid and describes it. It may carry an action, such as a retry. */
  error?: ReactNode;
  /** Progress the user should hear without moving focus, such as a save in flight. */
  status?: ReactNode;
}

interface FormFieldProps extends ChromeProps {
  children: (control: ControlProps) => ReactNode;
}

export function FormField({ label, error, status, children }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  // Truthiness, so `error={touched && message}` reads its `false` as valid.
  const invalid = Boolean(error);

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-1 text-muted text-row">
        {label}
      </label>
      {children({ id, "aria-invalid": invalid, "aria-describedby": invalid ? errorId : undefined })}
      {/* Rendered and left in the accessibility tree while empty: a live region added with
          its text is often not announced. A margin rather than the parent's gap spaces it, so
          an empty one takes no room. */}
      <span role="status" aria-live="polite" className="mt-1 text-muted text-row empty:mt-0">
        {invalid ? null : status}
      </span>
      {invalid && (
        <span
          id={errorId}
          role="alert"
          className="mt-1 flex items-center gap-2 text-accent-text text-row"
        >
          {error}
        </span>
      )}
    </div>
  );
}

type InputFieldProps = ChromeProps &
  Omit<
    ComponentProps<"input">,
    "id" | "aria-invalid" | "aria-describedby" | "children" | "className"
  >;

export function InputField({ label, error, status, ...input }: InputFieldProps) {
  return (
    <FormField label={label} error={error} status={status}>
      {(control) => (
        <input
          {...input}
          {...control}
          className="rounded-control border border-border bg-surface px-2 py-1"
        />
      )}
    </FormField>
  );
}
