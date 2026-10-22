import { type CharacterRecord, displayName, entryKey } from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import type { LevelHistoryRow } from "../../../lib/levelHistory.ts";
import { withoutLevelsFrom } from "../../../lib/levelRemoval.ts";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

const named = (row: LevelHistoryRow) =>
  `level ${row.level} (${displayName(row.cls)} ${row.classLevel})`;

/**
 * Confirms removing a level past the first and every level after it, with what each brought,
 * naming the levels that go, then removes them as one write and one undo entry. `rows` are the
 * levels that go, oldest first; Cancel, Escape and Close go back to the Edit dialog. The write
 * is refused, and says so, where the levels no longer match `rows` or the server holds an edit
 * since the record was read, as after a level-up from another tab.
 */
export function LevelRemoval({
  character,
  rows,
  onBack,
  onRemoved,
}: {
  character: CharacterRecord;
  rows: readonly [LevelHistoryRow, ...LevelHistoryRow[]];
  onBack: () => void;
  onRemoved: () => void;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const first = rows[0];
  const from = first.level;
  const last = from + rows.length - 1;
  const many = rows.length > 1;
  const listed = rows.map(named);
  const names = many ? `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}` : listed[0];
  const entered = rows.some((row) => row.classLevel === 1);

  function remove() {
    update.mutate(
      {
        edit: (latest) => {
          const same =
            latest.levels.length === last &&
            rows.every((row) => {
              const held = latest.levels[row.level - 1];
              return held !== undefined && entryKey(held.class) === entryKey(row.cls);
            });
          if (!same) throw new Error(`the levels changed before ${names} could be removed.`);
          return withoutLevelsFrom(latest, from);
        },
        readAt: character.updatedAt,
        ownUndoEntry: true,
      },
      { onSuccess: onRemoved },
    );
  }

  return (
    <Modal onClose={onBack}>
      <ModalEntry
        title={many ? `Remove levels ${from} to ${last}` : `Remove level ${from}`}
        footer={
          <div className="flex items-center gap-2">
            <p role="alert" className="text-error text-row">
              {update.isError &&
                `Couldn't remove the ${many ? "levels" : "level"}: ${update.error.message}`}
            </p>
            <button
              type="button"
              onClick={onBack}
              className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-disabled={update.isPending}
              onClick={() => {
                if (!update.isPending) remove();
              }}
              className={`${BUTTON} border border-error bg-surface text-error hover:bg-subtle aria-disabled:cursor-wait aria-disabled:opacity-60`}
            >
              {many ? `Remove ${rows.length} levels` : `Remove ${named(first)}`}
            </button>
          </div>
        }
      >
        <p>
          Remove {names}, with everything chosen at {many ? "those levels" : "that level"}.
          Experience points stay
          {entered ? ", as do the proficiencies a class brought" : ""}.
        </p>
      </ModalEntry>
    </Modal>
  );
}
