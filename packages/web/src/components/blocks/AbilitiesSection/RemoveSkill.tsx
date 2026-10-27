import type { CharacterDefinition } from "@dnd/character";
import { useContext } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InModal } from "../../inModalContext.ts";
import { ModalEntry } from "../../ModalEntry.tsx";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

interface RemoveSkillProps {
  characterId: string;
  name: string;
  overridePrefix: string;
  without: (definition: CharacterDefinition) => CharacterDefinition;
  onRemoved?: () => void;
}

/**
 * Asks before removing a skill, in an entry that replaces the skill's detail. Confirming
 * removes the skill and its overrides in one write, so a new skill taking its name starts
 * computed. `without` drops the skill from the lists that hold it; `overridePrefix` is the
 * key every override of it starts with. `onRemoved`, where given, runs once the write lands;
 * the row, and the modal with it, unmount as the saved character drops the skill. Cancel
 * goes back to the detail.
 */
function ConfirmRemoveSkill({
  characterId,
  name,
  overridePrefix,
  without,
  onRemoved,
}: RemoveSkillProps) {
  const back = useContext(InModal)?.back;
  const update = useUpdateCharacterDefinition(characterId);

  // The entry shows a failure from the mutation's state; the empty handler only keeps the
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
    <ModalEntry
      title={`Remove ${name}?`}
      footer={
        <div className="flex items-center gap-2">
          <p role="alert" className="text-error text-row">
            {update.isError && `Couldn't remove ${name}: ${update.error.message}`}
          </p>
          <button
            type="button"
            onClick={back}
            className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-disabled={update.isPending}
            onClick={remove}
            className={`${BUTTON} border border-error bg-surface text-error hover:bg-subtle aria-disabled:cursor-wait aria-disabled:opacity-60`}
          >
            Remove {name}
          </button>
        </div>
      }
    >
      <p>
        Remove {name} from this character, with its proficiency level, overrides and any flat bonus.
        Undo brings it back, and it stays listed in Settings.
      </p>
    </ModalEntry>
  );
}

/** The button in a skill's detail that opens the confirmation. */
export function RemoveSkill(props: RemoveSkillProps) {
  const modal = useContext(InModal);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => modal?.open(<ConfirmRemoveSkill {...props} />)}
      className="shrink-0 rounded-control bg-accent px-3.5 py-2 font-semibold text-row text-white hover:bg-accent-hover"
    >
      Remove {props.name}
    </button>
  );
}
