import type { CharacterRecord, EntryRef } from "@dnd/character";
import { useState } from "react";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import { CatalogPicker } from "../CatalogPicker/CatalogPicker.tsx";
import type { HomebrewEntry } from "./homebrewDraft.ts";
import { SkillCopyChoice } from "./SkillCopyChoice.tsx";
import { useHomebrewCopy } from "./useHomebrewCopy.ts";

export interface CopyFromFieldProps {
  collection: HomebrewCollection;
  /** The kind as `/search` names it, such as `spell`. */
  type: string;
  edition: CharacterRecord["edition"];
  onCopy: (entry: HomebrewEntry) => void;
}

const LABEL = "Copy from";

/**
 * Starts a new entry from an existing catalog or homebrew entry of the same kind and
 * edition: its fields, renamed so no entry of the kind holds the name, and nothing saved.
 */
export function CopyFromField({ collection, type, edition, onCopy }: CopyFromFieldProps) {
  const copy = useHomebrewCopy(collection, type);
  const [copying, setCopying] = useState<string>();
  const pick = (ref: EntryRef, name: string) => {
    setCopying(name);
    copy.mutate({ ref, name }, { onSuccess: onCopy });
  };
  return (
    <div className="flex flex-col">
      {type === "skill" ? (
        <SkillCopyChoice label={LABEL} edition={edition} onPick={pick} />
      ) : (
        <CatalogPicker
          label={LABEL}
          edition={edition}
          type={type}
          placeholder="Search…"
          onPick={(ref, hit) => pick(ref, hit.name)}
        />
      )}
      <span role="status" aria-live="polite" className="text-muted text-row">
        {copy.isPending && `Copying ${copying}…`}
      </span>
      {copy.isError && (
        <span role="alert" className="text-error text-row">
          Could not copy {copying}: {copy.error.message}
        </span>
      )}
    </div>
  );
}
