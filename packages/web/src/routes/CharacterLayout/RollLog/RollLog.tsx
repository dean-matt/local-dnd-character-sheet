import type { rollLogEntrySchema } from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { EmptyNote } from "../../../components/EmptyNote.tsx";
import { useCharacterRolls } from "../../../hooks/useCharacterRolls.ts";

type Roll = z.infer<typeof rollLogEntrySchema>;

const announcement = (roll: Roll) => `Rolled ${roll.label}: ${roll.total}`;

/**
 * The character's recent rolls, newest first. The heading takes focus when the panel
 * opens. `latest` is the roll that just landed; the status region is in the panel before
 * the effect fills it, so a reader speaks it even when the roll is what opened the panel.
 */
export function RollLog({ characterId, latest }: { characterId: string; latest: Roll | null }) {
  const log = useCharacterRolls(characterId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [announced, setAnnounced] = useState("");

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    if (latest) setAnnounced(announcement(latest));
  }, [latest]);

  const rolls = log.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <h2 ref={heading} tabIndex={-1} className="font-bold text-title">
        Roll Log
      </h2>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
      {log.isError && <p className="text-error text-row">{log.error.message}</p>}
      {log.isSuccess && rolls.length === 0 && <EmptyNote>No rolls yet.</EmptyNote>}
      <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto p-1">
        {rolls.map((roll) => (
          <li
            key={roll.id}
            className="flex items-baseline justify-between gap-2 rounded-control border border-border px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-bold">{roll.label}</span>
              <span className="text-muted text-row">{roll.notation}</span>
            </span>
            <strong className="text-title">{roll.total}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
