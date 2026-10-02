import type { CharacterRecord } from "@dnd/character";
import { Card } from "../Card.tsx";
import { EmptyNote } from "../EmptyNote.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

export function NotesSection({ character }: { character: CharacterRecord | undefined }) {
  if (!character) return <SectionUnavailable page="Notes" />;
  const { notes } = character.definition;
  return (
    <Card title="Notes">
      {notes.trim() ? (
        <p className="whitespace-pre-wrap text-body">{notes}</p>
      ) : (
        <EmptyNote>No notes yet.</EmptyNote>
      )}
    </Card>
  );
}
