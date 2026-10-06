import type { ComponentProps } from "react";
import { FormField, type FormFieldProps } from "./FormField.tsx";

type InputFieldProps = Omit<FormFieldProps, "children"> &
  Omit<ComponentProps<"input">, "id" | "aria-invalid" | "aria-describedby" | "children">;

/** `className` adds to the input's own border and padding rather than replacing them. */
export function InputField({
  label,
  labelHidden,
  error,
  status,
  messageSlot,
  className,
  ...input
}: InputFieldProps) {
  return (
    <FormField
      label={label}
      labelHidden={labelHidden}
      error={error}
      status={status}
      messageSlot={messageSlot}
    >
      {(control) => (
        <input
          {...input}
          {...control}
          className={`rounded-control border border-border bg-surface px-2 py-1 aria-invalid:border-error ${className ?? ""}`}
        />
      )}
    </FormField>
  );
}
