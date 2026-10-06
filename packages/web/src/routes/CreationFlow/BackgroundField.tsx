import { type BackgroundRecord, proficiencyGrantsSchema, type SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, displayName, type EntryRef } from "@dnd/character";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { ChosenChip } from "./ChosenChip.tsx";
import { grantNames } from "./grants.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

const grantsOf = (row: BackgroundRecord | undefined) => {
  const names = row ? grantNames(proficiencyGrantsSchema.parse(row.json)) : [];
  return names.length > 0 ? names.join(", ") : undefined;
};

/** The background, chosen through the picker, each result saying what it grants first. */
export function BackgroundField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const background = useWatch<CharacterDefinition, "background">({ name: "background" });
  const { edition, backgrounds, backgroundRow } = useIdentityCatalog();
  const [moved, setMoved] = useState(false);

  function choose(ref: EntryRef | undefined) {
    setValue("background", ref as EntryRef, { shouldDirty: true });
    setMoved(true);
  }

  if (background === undefined) {
    const describe = (hit: SearchHit) => {
      if (!("source" in hit)) return undefined;
      const row = backgrounds.data?.items.find(
        (each) => each.name === hit.name && each.source === hit.source,
      );
      const grants = grantsOf(row);
      return grants && `Grants ${grants}`;
    };
    return (
      <CatalogPicker
        label="Background"
        edition={edition}
        type="background"
        placeholder="Choose a background…"
        focusOnMount={moved}
        describe={describe}
        onPick={(ref) => choose(ref)}
      />
    );
  }

  const grants = grantsOf(backgroundRow);
  return (
    <div className="flex flex-col">
      <ChosenChip
        label="Background"
        value={displayName(background)}
        focusOnMount={moved}
        onClear={() => choose(undefined)}
      />
      {grants && <p className="mt-1.5 text-muted text-row">Grants: {grants}</p>}
    </div>
  );
}
