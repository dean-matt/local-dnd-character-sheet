import { useCallback } from "react";
import { useUpdateCharacterDefinition } from "./useUpdateCharacterDefinition.ts";

/** Sets one override key on a character's definition, or removes it on `null`. */
export function useSaveOverride(id: string) {
  const { mutateAsync } = useUpdateCharacterDefinition(id);
  return useCallback(
    async (key: string, next: number | null) => {
      await mutateAsync((latest) => {
        const { [key]: _, ...rest } = latest.overrides;
        return { ...latest, overrides: next === null ? rest : { ...rest, [key]: next } };
      });
    },
    [mutateAsync],
  );
}
