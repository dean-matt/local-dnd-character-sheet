import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";

/**
 * Removes a custom skill and its overrides in one write, so a new skill taking its name
 * starts computed. It mounts with the skill's detail modal, so a failure shown there
 * clears when the modal closes. `onRemoved` runs once the write lands; the row, and the
 * modal with it, unmount as the saved character drops the skill.
 */
export function RemoveCustomSkill({
  characterId,
  name,
  onRemoved,
}: {
  characterId: string;
  name: string;
  onRemoved: () => void;
}) {
  const update = useUpdateCharacterDefinition(characterId);
  const prefix = `customSkills.${name}.`;

  // The modal shows a failure from the mutation's state; the empty handler only keeps the
  // rejection from going unhandled.
  function remove() {
    if (update.isPending) return;
    update
      .mutateAsync((latest) => ({
        ...latest,
        customSkills: latest.customSkills.filter((each) => each.name !== name),
        overrides: Object.fromEntries(
          Object.entries(latest.overrides).filter(([key]) => !key.startsWith(prefix)),
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
