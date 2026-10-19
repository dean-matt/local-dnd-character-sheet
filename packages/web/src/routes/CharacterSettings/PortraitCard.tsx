import type { CharacterRecord } from "@dnd/character";
import { Card } from "../../components/Card.tsx";
import { CharacterPortrait } from "../../components/CharacterPortrait.tsx";
import { useRemovePortrait } from "../../hooks/useRemovePortrait.ts";

/** The character's avatar as it stands, with Remove where an uploaded portrait is set. */
export function PortraitCard({
  character,
  buttonClass,
}: {
  character: CharacterRecord;
  buttonClass: string;
}) {
  const remove = useRemovePortrait(character.id);
  return (
    <Card title="Portrait">
      <div className="flex items-center gap-3">
        <CharacterPortrait character={character} className="size-12 text-[17px]" />
        {character.portraitUpdatedAt ? (
          <button
            type="button"
            aria-disabled={remove.isPending}
            onClick={() => {
              if (!remove.isPending) remove.mutate();
            }}
            className={`${buttonClass} text-ink`}
          >
            Remove portrait
          </button>
        ) : (
          <p className="text-muted text-row">
            Upload one from the camera badge beside the character's name.
          </p>
        )}
      </div>
      {remove.isError && (
        <p role="alert" className="mt-2 text-error text-row">
          Remove failed: {remove.error.message}
        </p>
      )}
    </Card>
  );
}
