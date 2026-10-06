/**
 * The form a multi-field flow renders: it owns the `react-hook-form` instance, its
 * provider and the `<form>`, validates against `schema` through the Zod resolver, and
 * keeps the in-progress values as a draft under `flow`. A stored draft wins over
 * `defaultValues` on mount. `lib/createForm.ts` binds a schema and a flow to it once per
 * form.
 *
 * The draft clears once `onSubmit` resolves, or on `cancel`; an `onSubmit` that throws
 * leaves it standing, and its rejection stops here rather than going unhandled. So an
 * `onSubmit` must surface its own failure, such as a mutation's `error`: the shell
 * reports none. Every descendant `<button>` without a `type` attribute is given
 * `type="button"`, so a secondary action inside a step cannot submit, while Enter in a
 * field still submits through the form's own submit button.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  // A layout effect, so the first buttons are typed before paint; the observer's callback
  // runs as a microtask, so a button rendered later is typed before any click reaches it.
  useLayoutEffect(() => {
    const element = formRef.current;
    if (element === null) return;
    const typeButtons = () => {
      for (const button of element.querySelectorAll("button:not([type])")) {
        button.setAttribute("type", "button");
      }
    };
    typeButtons();
    const observer = new MutationObserver(typeButtons);
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["type"],
    });
    return () => observer.disconnect();
  }, []);

  const cancel = () => {
    discard();
    onCancel?.();
  };

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) =>
          form
            .handleSubmit(async (values) => {
              await onSubmit(values);
              discard();
            })(event)
            .catch(() => {})
        }
      >
        {children({ cancel })}
      </form>
    </FormProvider>
  );
}
