import { useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useImportCharacter } from "../hooks/useImportCharacter.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-body";

/**
 * New Character and Import, on the dashboard and the character list. Import picks a
 * character file and opens the character it creates, or says why the file was refused.
 */
export function CharacterActions({ newFirst = false }: { newFirst?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const importCharacter = useImportCharacter();
  const navigate = useNavigate();
  const importButton = (
    <button
      type="button"
      aria-disabled={importCharacter.isPending}
      onClick={() => {
        if (!importCharacter.isPending) picker.current?.click();
      }}
      className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle aria-disabled:cursor-wait aria-disabled:opacity-60`}
    >
      Import
    </button>
  );
  const newLink = (
    <Link to="/characters/new" className={`${BUTTON} bg-accent text-white hover:bg-accent-hover`}>
      + New Character
    </Link>
  );
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-2">
        {newFirst ? newLink : importButton}
        {newFirst ? importButton : newLink}
      </div>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        aria-label="Character file"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          importCharacter.mutate(file, {
            onSuccess: (record) => navigate(`/characters/${record.id}`),
          });
        }}
      />
      {importCharacter.isError && (
        <p role="alert" className="max-w-md text-error text-row">
          Import failed: {importCharacter.error.message}
        </p>
      )}
    </div>
  );
}
