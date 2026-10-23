import type { CharacterRecord } from "@dnd/character";
import { Card } from "../../components/Card.tsx";
import { CharacterPortrait } from "../../components/CharacterPortrait.tsx";
import { useRemovePortrait } from "../../hooks/useRemovePortrait.ts";
import { useRestorePortrait } from "../../hooks/useRestorePortrait.ts";

/**
 * The character's avatar as it stands, with Remove where an uploaded portrait is set and
 * Restore where an upload or removal displaced one. Restore swaps the two, so pressing it
 * again undoes it.
 */
export function PortraitCard({
  character,
  buttonClass,
}: {
  character: CharacterRecord;
  buttonClass: string;
}) {
  const remove = useRemovePortrait(character.id);
  const restore = useRestorePortrait(character.id);
  const hasPortrait = character.portraitUpdatedAt !== null;
  return (
    <Card title="Portrait">
      <div className="flex flex-wrap items-center gap-3">
        <CharacterPortrait character={character} className="size-12 text-[17px]" />
        {hasPortrait && (
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
        )}
        {character.hasPreviousPortrait && (
          <button
            type="button"
            aria-disabled={restore.isPending}
            onClick={() => {
              if (!restore.isPending) restore.mutate();
            }}
            className={`${buttonClass} text-ink`}
          >
            Restore previous portrait
          </button>
        )}
      </div>
      <p className="mt-2 text-muted text-row">
        {hasPortrait
          ? "Restore previous portrait brings back the image the last upload or removal replaced, until the next one."
          : "Upload one from the camera badge beside the character's name."}
      </p>
      {remove.isError && (
        <p role="alert" className="mt-2 text-error text-row">
          Remove failed: {remove.error.message}
        </p>
      )}
      {restore.isError && (
        <p role="alert" className="mt-2 text-error text-row">
          Restore failed: {restore.error.message}
        </p>
      )}
    </Card>
  );
}
