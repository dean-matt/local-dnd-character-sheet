/**
 * The form a multi-field flow renders: it owns the `react-hook-form` instance, its
 * provider and the `<form>`, validates against `schema` through the Zod resolver, and
 * keeps the in-progress values as a draft under `flow`. A stored draft wins over
 * `defaultValues` on mount. `lib/createForm.ts` binds a schema and a flow to it once per
 * form, and is the only reader.
 *
 * The draft clears once `onSubmit` resolves, or on `cancel`; an `onSubmit` that throws
 * leaves it standing. A submit from a `<button>` without a `type` attribute is dropped, so
 * such a button acts as `type="button"` and a secondary action inside a step cannot submit.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState } from "react";
import { type DefaultValues, type FieldValues, FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import { readDraft, useFormDraft } from "./formDraft.ts";

export interface FormShellProps<In extends FieldValues, Out extends FieldValues> {
  schema: z.ZodType<Out, In>;
  flow: string;
  defaultValues: DefaultValues<In>;
  onSubmit: (values: Out) => void | Promise<void>;
  /** Runs after `cancel` discards the draft, to leave the flow. */
  onCancel?: () => void;
  children: (actions: { cancel: () => void }) => ReactNode;
}

export function FormShell<In extends FieldValues, Out extends FieldValues>({
  schema,
  flow,
  defaultValues,
  onSubmit,
  onCancel,
  children,
}: FormShellProps<In, Out>) {
  const [initialValues] = useState(() => ({ ...defaultValues, ...readDraft(flow) }));
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });
  const discard = useFormDraft(flow, form.watch);

  const cancel = () => {
    discard();
    onCancel?.();
  };

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          if ((event.nativeEvent as SubmitEvent).submitter?.hasAttribute("type") === false) {
            event.preventDefault();
            return;
          }
          void form.handleSubmit(async (values) => {
            await onSubmit(values);
            discard();
          })(event);
        }}
      >
        {children({ cancel })}
      </form>
    </FormProvider>
  );
}
