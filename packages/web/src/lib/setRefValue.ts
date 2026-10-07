import type {
  FieldPath,
  FieldValues,
  PathValue,
  SetValueConfig,
  UseFormSetValue,
} from "react-hook-form";

/**
 * `setValue` for a value holding a key named `ref`, such as a list of inventory entries.
 * react-hook-form compares the old value with the new before writing, and its comparison
 * skips every key named `ref`, taking it for an element ref, so two lists differing only
 * in their references read as equal and the write is silently dropped. Clearing the
 * field first makes the write land.
 */
export function setRefValue<T extends FieldValues, N extends FieldPath<T>>(
  setValue: UseFormSetValue<T>,
  name: N,
  value: PathValue<T, N>,
  options?: SetValueConfig,
) {
  setValue(name, undefined as PathValue<T, N>);
  setValue(name, value, options);
}
