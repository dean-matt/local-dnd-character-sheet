import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { HIGHEST_LEVEL, withClassCount } from "./classLevels.ts";

export interface AddClassFieldProps {
  edition: CharacterDefinition["edition"];
  /** Bumped to move focus to the button, as when a removed class's row gave way. */
  focusRequest: number;
  onAdded: (ref: EntryRef) => void;
}

const refOf = (hit: SearchHit): EntryRef =>
  "id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source };

/**
 * "Add another class", which opens a picker for a further class at 1st level in it. A
 * class the character already holds stays listed and cannot be picked, and a character at
 * the highest level takes no further class.
 */
export function AddClassField({ edition, focusRequest, onAdded }: AddClassFieldProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const levels = useWatch<CharacterDefinition, "levels">({ name: "levels" }) ?? [];
  const [adding, setAdding] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusRequest > 0) button.current?.focus();
  }, [focusRequest]);

  if (levels.length >= HIGHEST_LEVEL) {
    return (
      <p className="text-muted text-row">
        The character is at level {HIGHEST_LEVEL}, so takes no further class.
      </p>
    );
  }
  const held = new Set(levels.map((level) => entryKey(level.class)));
  if (adding) {
    return (
      <CatalogPicker
        label="Another class"
        edition={edition}
        type="class"
        placeholder="Choose a class…"
        focusOnMount
        unavailableReason={(hit) =>
          held.has(entryKey(refOf(hit))) ? "Already one of the character's classes" : undefined
        }
        onPick={(ref) => {
          setValue("levels", withClassCount(getValues("levels") ?? [], ref, 1), {
            shouldDirty: true,
          });
          setAdding(false);
          onAdded(ref);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      ref={button}
      onClick={() => setAdding(true)}
      className="flex w-fit items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body"
    >
      <Plus aria-hidden="true" size={14} className="shrink-0 text-muted" />
      Add another class
    </button>
  );
}
