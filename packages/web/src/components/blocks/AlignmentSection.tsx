import { type CharacterRecord, characterDefinitionSchema } from "@dnd/character";
import { useId } from "react";
import { useUpdateCharacterDefinition } from "../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../Card.tsx";
import { Field } from "../Field/Field.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

/** Offered, not enforced: the schema keeps alignment free text for a setting's own. */
const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

export function AlignmentSection({ character }: { character: CharacterRecord | undefined }) {
  const update = useUpdateCharacterDefinition(character?.id ?? "");
  const listId = useId();
  if (!character) return <SectionUnavailable page="Alignment" />;
  return (
    <Card title="Alignment">
      <Field
        mode="edit"
        label="Alignment"
        labelHidden
        current={character.definition.alignment ?? ""}
        format={(alignment) => alignment}
        parse={(raw) => raw.trim()}
        schema={characterDefinitionSchema.shape.alignment.unwrap()}
        list={listId}
        placeholder="No alignment set"
        onSave={async (alignment: string | null) => {
          await update.mutateAsync(({ alignment: _cleared, ...latest }) =>
            alignment === null ? latest : { ...latest, alignment },
          );
        }}
      />
      <datalist id={listId}>
        {ALIGNMENTS.map((alignment) => (
          <option key={alignment} value={alignment} />
        ))}
      </datalist>
    </Card>
  );
}
