import type { ComponentProps } from "react";
import { FormField, type FormFieldProps } from "./FormField.tsx";

type InputFieldProps = Omit<FormFieldProps, "children"> &
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
