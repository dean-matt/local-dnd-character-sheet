import { useHeldWrites } from "./useHeldWrites.ts";
import { useSaveToast } from "./useSaveToast.ts";
import { useUpdateCharacterDefinition } from "./useUpdateCharacterDefinition.ts";

/**
 * `useHeldWrites` over one character's definition, with its newest failure raised as a toast
 * naming `field` and offering Retry. Returns the write.
 */
export function useHeldSave(id: string, field: string) {
  const writes = useHeldWrites(useUpdateCharacterDefinition(id));
  const failure = writes.latest?.error;
  useSaveToast(
    field,
    failure ? `Couldn't save: ${failure.message}` : undefined,
    writes.retry,
    failure,
  );
  return writes.write;
}
