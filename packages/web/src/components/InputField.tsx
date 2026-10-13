import type { ComponentProps } from "react";
import { FormField, type FormFieldProps } from "./FormField.tsx";

type InputFieldProps = Omit<FormFieldProps, "children"> &
  Omit<ComponentProps<"input">, "id" | "aria-invalid" | "aria-describedby" | "children">;

/** `className` adds utilities over the shared `control` box; one it sets, such as a text size, wins. */
export function InputField({
  label,
  labelHidden,
  error,
  invalid,
  status,
  describedBy,
  messageSlot,
  className,
  ...input
}: InputFieldProps) {
  return (
    <FormField
      label={label}
      labelHidden={labelHidden}
      error={error}
      invalid={invalid}
      status={status}
      describedBy={describedBy}
      messageSlot={messageSlot}
    >
      {(control) => <input {...input} {...control} className={`control ${className ?? ""}`} />}
    </FormField>
  );
}
