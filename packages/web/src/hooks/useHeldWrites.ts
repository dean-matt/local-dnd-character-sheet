import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import type { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";

type DefinitionEdit = (definition: CharacterDefinition) => CharacterDefinition;
type Held = { error: Error; edit: DefinitionEdit };

/**
 * Writes a list field one item at a time under `key`, holding each item's last failure until
 * a write to that item lands. A mutation keeps only its latest write's error, so a later
 * write to another item would otherwise clear a failure whose change never saved.
 *
 * `latest` is the newest failure still held, `failed` every held item's key, and `retry`
 * replays each held edit against the latest definition. `write` never rejects.
 */
export function useHeldWrites(update: UseMutationResult<CharacterRecord, Error, DefinitionEdit>) {
  const [held, setHeld] = useState<ReadonlyMap<string, Held>>(new Map());
  const write = (key: string, edit: DefinitionEdit) =>
    update.mutateAsync(edit).then(
      () =>
        setHeld((current) => {
          if (!current.has(key)) return current;
          const next = new Map(current);
          next.delete(key);
          return next;
        }),
      (error: Error) =>
        setHeld((current) => {
          const next = new Map(current);
          // Deleted first so the newest failure sits last.
          next.delete(key);
          return next.set(key, { error, edit });
        }),
    );
  const retry = () => {
    for (const [key, { edit }] of held) write(key, edit);
  };
  const newest = [...held].at(-1);
  const latest = newest ? { key: newest[0], error: newest[1].error } : null;
  return { write, latest, failed: new Set(held.keys()), retry };
}
