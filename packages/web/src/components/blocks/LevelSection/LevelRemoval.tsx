import { type CharacterRecord, displayName, entryKey } from "@dnd/character";
import { useId, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import type { LevelHistoryRow } from "../../../lib/levelHistory.ts";
import { withoutNewestLevel } from "../../../lib/levelRemoval.ts";

const BUTTON = "rounded-control border border-border bg-surface px-2 py-1 font-semibold text-row";

/**
 * Removes the newest level and what it brought, once the player confirms the level it
 * names, as one write and one undo entry. The write is refused, and says so, where the
 * newest level is no longer `row`, as after a level-up from another tab.
 */
export function LevelRemoval({
  character,
  row,
}: {
  character: CharacterRecord;
  row: LevelHistoryRow;
}) {
  const panel = useId();
  const [open, setOpen] = useState(false);
  const update = useUpdateCharacterDefinition(character.id);
  const named = `level ${row.level} (${displayName(row.cls)} ${row.classLevel})`;

  function remove() {
    update.mutate(
      {
        edit: (latest) => {
          const newest = latest.levels.at(-1);
          if (
            latest.levels.length !== row.level ||
            !newest ||
            entryKey(newest.class) !== entryKey(row.cls)
          )
            throw new Error(`the newest level changed before ${named} could be removed.`);
          return withoutNewestLevel(latest);
        },
        ownUndoEntry: true,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
        className="text-label text-muted underline"
      >
        Remove newest level
      </button>
      {open && (
        <div id={panel} className="mt-1 flex flex-col gap-1.5">
          <p className="text-body">
            Remove {named} with its hit points and what was chosen for it: the subclass,
            improvement, feature choices, spells and options. Experience points stay
            {row.classLevel === 1 ? ", as do the proficiencies the class brought" : ""}.
          </p>
          <p className="text-label text-muted">
            Only the newest level can be removed: an earlier one would change the class level of
            every level after it, and what each of them was entitled to choose.
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-disabled={update.isPending}
              onClick={() => {
                if (!update.isPending) remove();
              }}
              className={`${BUTTON} text-error aria-disabled:cursor-wait aria-disabled:opacity-60`}
            >
              Remove {named}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={BUTTON}>
              Keep it
            </button>
          </div>
          {update.isError && (
            <p role="alert" className="text-error text-row">
              Couldn't remove the level: {update.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
