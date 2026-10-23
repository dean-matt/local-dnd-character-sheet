import type { CharacterDefinition } from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";

/**
 * Removes a skill and its overrides in one write, so a new skill taking its name starts
 * computed. `without` drops the skill from the lists that hold it; `overridePrefix` is the
 * key every override of it starts with. It mounts with the skill's detail modal, so a
 * failure shown there clears when the modal closes. `onRemoved`, where given, runs once the write lands;
 * the row, and the modal with it, unmount as the saved character drops the skill.
 */
export function RemoveSkill({
  characterId,
  name,
  overridePrefix,
  without,
  onRemoved,
}: {
  characterId: string;
  name: string;
  overridePrefix: string;
  without: (definition: CharacterDefinition) => CharacterDefinition;
  onRemoved?: () => void;
}) {
  const update = useUpdateCharacterDefinition(characterId);

  // The modal shows a failure from the mutation's state; the empty handler only keeps the
  // rejection from going unhandled.
  function remove() {
    if (update.isPending) return;
    update
      .mutateAsync((latest) => ({
        ...without(latest),
        overrides: Object.fromEntries(
          Object.entries(latest.overrides).filter(([key]) => !key.startsWith(overridePrefix)),
        ),
      }))
      .then(onRemoved, () => {});
  }

  return (
    <div className="flex items-center gap-2">
      <p role="alert" className="text-error text-row">
        {update.isError && `Couldn't remove ${name}: ${update.error.message}`}
      </p>
      <button
        type="button"
        aria-disabled={update.isPending}
        onClick={remove}
        className="shrink-0 rounded-control bg-accent px-3.5 py-2 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        Remove {name}
      </button>
    </div>
  );
}
