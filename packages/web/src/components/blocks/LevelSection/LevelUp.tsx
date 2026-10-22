import { type CharacterRecord, experienceThreshold, MAX_LEVEL, totalLevel } from "@dnd/character";
import { useId, useState } from "react";
import { LevelUpDialog } from "./LevelUpDialog.tsx";

/**
 * The button that opens the level-up, offered below the highest level and, where the
 * character levels by experience, once the total reaches the next level's threshold.
 * `describedBy` names the experience caption that says why it waits, which the button
 * cites in place of a caption of its own.
 */
export function LevelUp({
  character,
  describedBy,
}: {
  character: CharacterRecord;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const ownId = useId();
  const { definition } = character;
  const level = totalLevel(definition);
  const short =
    definition.leveling === "xp" &&
    level < MAX_LEVEL &&
    definition.experience < experienceThreshold(level + 1);
  const blocked = level >= MAX_LEVEL || short;
  const own = level >= MAX_LEVEL && describedBy === undefined;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-disabled={blocked}
        aria-describedby={blocked ? (describedBy ?? (own ? ownId : undefined)) : undefined}
        onClick={() => !blocked && setOpen(true)}
        className="w-full rounded-control bg-accent px-3 py-2 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
      >
        Level up
      </button>
      {own && (
        <p id={ownId} className="text-center text-label text-muted">
          Level {MAX_LEVEL} is the highest level.
        </p>
      )}
      {open && <LevelUpDialog character={character} onClose={() => setOpen(false)} />}
    </div>
  );
}
