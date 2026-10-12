import { type CharacterRecord, experienceThreshold, totalLevel } from "@dnd/character";
import { useId, useState } from "react";
import { LevelUpDialog } from "./LevelUpDialog.tsx";

const MAX_LEVEL = 20;

/**
 * The button that opens the level-up, offered below level 20 and, where the character
 * levels by experience, once the total reaches the next level's threshold.
 */
export function LevelUp({ character }: { character: CharacterRecord }) {
  const [open, setOpen] = useState(false);
  const { definition } = character;
  const level = totalLevel(definition);
  const short =
    definition.leveling === "xp" && level < MAX_LEVEL
      ? experienceThreshold(level + 1) - definition.experience
      : 0;
  const blocked = level >= MAX_LEVEL || short > 0;
  const reason =
    level >= MAX_LEVEL
      ? `Level ${MAX_LEVEL} is the highest level.`
      : short > 0
        ? `${short.toLocaleString("en-US")} XP to go`
        : undefined;
  const reasonId = useId();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-disabled={blocked}
        aria-describedby={reason ? reasonId : undefined}
        onClick={() => !blocked && setOpen(true)}
        className="w-full rounded-control bg-accent px-3 py-2 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
      >
        Level up
      </button>
      {reason && (
        <p id={reasonId} className="text-center text-label text-muted">
          {reason}
        </p>
      )}
      {open && <LevelUpDialog character={character} onClose={() => setOpen(false)} />}
    </div>
  );
}
