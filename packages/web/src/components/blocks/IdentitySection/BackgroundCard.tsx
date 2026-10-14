import { type CharacterRecord, displayName, entryKey } from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { Card } from "../../Card.tsx";
import { ChangeablePick } from "./ChangeablePick.tsx";

/** The background, changed through the picker; what the new one grants is left for the player to apply. */
export function BackgroundCard({ character }: { character: CharacterRecord }) {
  const { background, edition } = character.definition;
  const write = useHeldSave(character.id, "Background");
  return (
    <Card title="Background">
      <ChangeablePick
        noun="background"
        value={displayName(background)}
        edition={edition}
        type="background"
        onPick={(ref) => {
          if (entryKey(ref) !== entryKey(background)) {
            write("background", (latest) => ({ ...latest, background: ref }));
          }
        }}
      />
    </Card>
  );
}
