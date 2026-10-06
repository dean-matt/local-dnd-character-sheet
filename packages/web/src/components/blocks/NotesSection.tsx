import { type CharacterDefinition, type CharacterRecord, SECTION_LABEL } from "@dnd/character";
import { Card } from "../Card.tsx";
import { EmptyNote } from "../EmptyNote.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

/**
 * The player's notes, and under them what the character holds against the rules as
 * printed, so a value creation let through reads as a choice rather than an error.
 */
export function NotesSection({ character }: { character: CharacterRecord | undefined }) {
  if (!character) return <SectionUnavailable page="Notes" />;
  const { notes, departures } = character.definition;
  return (
    <div className="flex flex-col gap-4">
      <Card title="Notes">
        {notes.trim() ? (
          <p className="whitespace-pre-wrap text-body">{notes}</p>
        ) : (
          <EmptyNote>No notes yet.</EmptyNote>
        )}
      </Card>
      {departures.length > 0 && (
        <Card title="Off the rules">
          <ul className="flex flex-col gap-1 text-body">
            {departures.map(({ field, note }) => (
              <li key={`${field}|${note}`}>
                <span className="font-semibold">
                  {SECTION_LABEL[field.split(".")[0] as keyof CharacterDefinition] ?? field}
                </span>{" "}
                — {note}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
