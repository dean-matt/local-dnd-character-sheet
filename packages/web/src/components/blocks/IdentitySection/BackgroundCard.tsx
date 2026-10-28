import { type CharacterRecord, displayName, entryKey } from "@dnd/character";
import { useBackgrounds } from "../../../hooks/useBackgrounds.ts";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { increaseSource } from "../../../lib/grantorIncreases.ts";
import { Card } from "../../Card.tsx";
import { ChangeablePick } from "./ChangeablePick.tsx";
import { OriginIncreases } from "./OriginIncreases.tsx";
import { OriginSpellBlocks } from "./OriginSpellBlocks.tsx";

/**
 * The background, changed through the picker, its increases, and which of its spell blocks
 * applies; what a new background grants is left for the player to apply.
 */
export function BackgroundCard({ character }: { character: CharacterRecord }) {
  const names = useHomebrewNames();
  const { definition } = character;
  const { background, edition } = definition;
  const write = useHeldSave(character.id, "Background");
  const catalogBackground = "name" in background ? background : undefined;
  const backgrounds = useBackgrounds(edition, catalogBackground !== undefined);
  const row = backgrounds.data?.items.find(
    (each) => each.name === catalogBackground?.name && each.source === catalogBackground.source,
  );
  return (
    <Card title="Background">
      <div className="flex flex-col gap-2">
        <ChangeablePick
          noun="background"
          value={displayName(background, names)}
          edition={edition}
          type="background"
          onPick={(ref) => {
            if (entryKey(ref) !== entryKey(background)) {
              write("background", (latest) => ({ ...latest, background: ref }));
            }
          }}
        />
        {(catalogBackground === undefined || backgrounds.isSuccess) && (
          <OriginIncreases
            definition={definition}
            source={increaseSource("background", displayName(background, names), row?.json)}
            write={write}
          />
        )}
        <OriginSpellBlocks
          definition={definition}
          row={catalogBackground && { grantor: "background", ref: catalogBackground }}
          kinds={["background"]}
          write={write}
        />
      </div>
    </Card>
  );
}
