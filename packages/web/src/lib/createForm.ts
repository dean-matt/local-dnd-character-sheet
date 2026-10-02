import { createElement } from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormRegisterReturn,
  useFormContext,
} from "react-hook-form";
import type { z } from "zod";
import { FormShell, type FormShellProps } from "../components/FormShell/FormShell.tsx";

interface FormConfig<In extends FieldValues, Out extends FieldValues> {
  /** A schema from `packages/character`, so the form holds no second definition of a legal character. */
  schema: z.ZodType<Out, In>;
  /** Keys the draft in `localStorage`; two forms sharing one share a draft. */
  flow: string;
  defaultValues: DefaultValues<In>;
}

/**
 * Binds one multi-field form, at module scope rather than in a render. `FormShell` holds
 * the form state; `useField` reaches it only from inside one, and returns what
 * `InputField` spreads: the registration and the field's error message, which a schema
 * refinement aimed at the field's path supplies for a choice an earlier one invalidated.
 */
export function createForm<In extends FieldValues, Out extends FieldValues>(
  config: FormConfig<In, Out>,
) {
  function BoundFormShell({
    draftScope,
    ...props
  }: Omit<FormShellProps<In, Out>, keyof FormConfig<In, Out>> & {
    /** Splits the flow's draft per instance, such as by character for level-up. */
    draftScope?: string;
  }) {
    const flow = draftScope === undefined ? config.flow : `${config.flow}:${draftScope}`;
    return createElement(FormShell<In, Out>, { ...config, ...props, flow });
  }

  function useField(name: Path<In>): UseFormRegisterReturn & { error?: string } {
    const form = useFormContext<In>();
    if (form === null) throw new Error(`useField("${name}") ran outside a FormShell`);
    const { error } = form.getFieldState(name, form.formState);
    return { ...form.register(name), error: error?.message };
  }

  return { FormShell: BoundFormShell, useField };
}
