import type { ComponentProps } from "react";
import { FormField, type FormFieldProps } from "./FormField.tsx";

type InputFieldProps = Omit<FormFieldProps, "children"> &
  Omit<ComponentProps<"input">, "id" | "aria-invalid" | "aria-describedby" | "children">;

/** `className` adds utilities over the shared `control` box; one it sets, such as a text size, wins. */
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
      {(control) => <input {...input} {...control} className={`control ${className ?? ""}`} />}
    </FormField>
  );
}
