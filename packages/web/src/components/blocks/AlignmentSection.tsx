import type { CharacterRecord } from "@dnd/character";
import { Card } from "../Card.tsx";
import { EmptyNote } from "../EmptyNote.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

export function AlignmentSection({ character }: { character: CharacterRecord | undefined }) {
  if (!character) return <SectionUnavailable page="Alignment" />;
  const { alignment } = character.definition;
  return (
    <Card title="Alignment">
      {alignment ? (
        <p className="text-sm">{alignment}</p>
      ) : (
        <EmptyNote>No alignment set.</EmptyNote>
      )}
    </Card>
  );
}
