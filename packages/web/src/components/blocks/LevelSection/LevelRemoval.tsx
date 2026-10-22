import { type CharacterRecord, displayName, entryKey } from "@dnd/character";
import { useId, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import type { LevelHistoryRow } from "../../../lib/levelHistory.ts";
import { withoutLevelsFrom } from "../../../lib/levelRemoval.ts";

const BUTTON = "rounded-control border border-border bg-surface px-2 py-1 font-semibold text-row";

const named = (row: LevelHistoryRow) =>
  `level ${row.level} (${displayName(row.cls)} ${row.classLevel})`;

/**
 * Removes a level past the first and every level after it, with what each brought, once the
 * player confirms the levels it names, as one write and one undo entry. `rows` are the levels
 * that go, oldest first. The write is refused, and says so, where the levels no longer match
 * `rows` or the server holds an edit since the record was read, as after a level-up from
 * another tab.
 */
export function LevelRemoval({
  character,
  rows,
  onRemoved,
}: {
  character: CharacterRecord;
  rows: readonly LevelHistoryRow[];
  onRemoved: () => void;
}) {
  const panel = useId();
  const [open, setOpen] = useState(false);
  const update = useUpdateCharacterDefinition(character.id);
  const first = rows[0];
  const newest = rows.at(-1);
  if (!first || !newest) return null;
  const many = rows.length > 1;
  const listed = rows.map(named);
  const names = many ? `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}` : listed[0];
  const entered = rows.some((row) => row.classLevel === 1);

  function remove() {
    update.mutate(
      {
        edit: (latest) => {
          const same =
            latest.levels.length === newest?.level &&
            rows.every((row) => {
              const held = latest.levels[row.level - 1];
              return held !== undefined && entryKey(held.class) === entryKey(row.cls);
            });
          if (!same) throw new Error(`the levels changed before ${names} could be removed.`);
          return withoutLevelsFrom(latest, first?.level ?? latest.levels.length);
        },
        readAt: character.updatedAt,
        ownUndoEntry: true,
      },
      { onSuccess: onRemoved },
    );
  }

  return (
    <section aria-labelledby={`${panel}-title`} className="flex flex-col gap-1.5">
      <h3 id={`${panel}-title`} className="font-semibold text-label text-muted uppercase">
        Remove
      </h3>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => {
          update.reset();
          setOpen(!open);
        }}
        className="w-fit text-label text-muted underline"
      >
        {many
          ? `Remove level ${first.level} and the levels after it`
          : `Remove level ${first.level}`}
      </button>
      {open && (
        <div id={panel} className="flex flex-col gap-1.5">
          <p className="text-body">
            Remove {names}, with {many ? "their" : "its"} hit points and what was chosen for{" "}
            {many ? "them" : "it"}: the subclass, improvement, feature choices, spells and options.
            Experience points stay
            {entered ? ", as do the proficiencies a class brought" : ""}.
          </p>
          {many && (
            <p className="text-label text-muted">
              The levels after level {first.level} go too: each one's class level, and what it was
              entitled to choose, rests on the levels before it.
            </p>
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-disabled={update.isPending}
              onClick={() => {
                if (!update.isPending) remove();
              }}
              className={`${BUTTON} text-error aria-disabled:cursor-wait aria-disabled:opacity-60`}
            >
              {many ? `Remove ${rows.length} levels` : `Remove ${named(first)}`}
            </button>
            <button
              type="button"
              onClick={() => {
                update.reset();
                setOpen(false);
              }}
              className={BUTTON}
            >
              Keep {many ? "them" : "it"}
            </button>
          </div>
          {update.isError && (
            <p role="alert" className="text-error text-row">
              Couldn't remove the {many ? "levels" : "level"}: {update.error.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
