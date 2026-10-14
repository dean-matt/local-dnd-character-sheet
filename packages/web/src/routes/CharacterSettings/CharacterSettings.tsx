import { useId, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card } from "../../components/Card.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { useDuplicateCharacter } from "../../hooks/useDuplicateCharacter.ts";
import { useExportCharacter } from "../../hooks/useExportCharacter.ts";
import { useReturnFocus } from "../../hooks/useReturnFocus.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { DeleteCharacterDialog } from "./DeleteCharacterDialog.tsx";
import { HouseRulesCard } from "./HouseRulesCard.tsx";

const BUTTON =
  "rounded-control border border-border bg-surface px-3.5 py-2 font-semibold text-row hover:bg-subtle aria-disabled:cursor-wait aria-disabled:opacity-60";

/**
 * What configures or acts on the character as a whole, at a fixed route Manage pages never
 * lists: its house rules, Duplicate and Export, and Delete behind its confirmation.
 */
export function CharacterSettings() {
  const { id = "" } = useParams();
  const character = useCharacter(id);
  const duplicate = useDuplicateCharacter(id);
  const exportFile = useExportCharacter({ id, name: character.data?.name ?? "" });
  const [deleting, setDeleting] = useState(false);
  const deleteButton = useReturnFocus<HTMLButtonElement>(deleting);
  const navigate = useNavigate();
  const heading = useId();

  if (character.isPending) return <LoadingState label="Loading character…" />;
  if (character.isError) return <ErrorState error={character.error} />;

  return (
    <section aria-labelledby={heading} className="flex flex-col gap-3">
      <h2 id={heading} className="font-bold text-lg">
        Character settings
      </h2>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HouseRulesCard character={character.data} />
        <Card title="Character file">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-disabled={duplicate.isPending}
              onClick={() => {
                if (duplicate.isPending) return;
                duplicate.mutate(undefined, {
                  onSuccess: (copy) => navigate(`/characters/${copy.id}`),
                });
              }}
              className={`${BUTTON} text-ink`}
            >
              Duplicate character
            </button>
            <button
              type="button"
              aria-disabled={exportFile.isPending}
              onClick={() => {
                if (!exportFile.isPending) exportFile.mutate();
              }}
              className={`${BUTTON} text-ink`}
            >
              Export character
            </button>
          </div>
          {duplicate.isError && (
            <p role="alert" className="mt-2 text-error text-row">
              Duplicate failed: {duplicate.error.message}
            </p>
          )}
          {exportFile.isError && (
            <p role="alert" className="mt-2 text-error text-row">
              Export failed: {exportFile.error.message}
            </p>
          )}
        </Card>
        <Card title="Danger zone">
          <button
            ref={deleteButton}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setDeleting(true)}
            className={`${BUTTON} text-accent`}
          >
            Delete character
          </button>
        </Card>
      </div>
      {deleting && (
        <DeleteCharacterDialog character={character.data} onClose={() => setDeleting(false)} />
      )}
    </section>
  );
}
