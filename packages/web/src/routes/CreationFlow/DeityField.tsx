import type { CharacterDefinition, DeityRef } from "@dnd/character";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { ChosenChip } from "./ChosenChip.tsx";

/**
 * The deity, optional, chosen through the picker and stored with its pantheon, which the
 * results and the chip both name: two gods can share the rest of their key.
 */
export function DeityField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const deity = useWatch<CharacterDefinition, "deity">({ name: "deity" });
  const edition = useWatch<CharacterDefinition, "edition">({ name: "edition" }) ?? "one";
  const [moved, setMoved] = useState(false);

  function choose(ref: DeityRef | undefined) {
    setValue("deity", ref, { shouldDirty: true });
    setMoved(true);
  }

  if (deity === undefined) {
    return (
      <CatalogPicker
        label="Deity (optional)"
        edition={edition}
        type="deity"
        placeholder="Choose a deity…"
        focusOnMount={moved}
        unavailableReason={(hit) =>
          "qualifier" in hit && hit.qualifier ? undefined : "names no pantheon"
        }
        onPick={(ref, hit) => {
          if ("name" in ref && "qualifier" in hit && hit.qualifier)
            choose({ ...ref, pantheon: hit.qualifier });
        }}
      />
    );
  }

  return (
    <ChosenChip
      label="Deity"
      value={`${deity.name} · ${deity.pantheon}`}
      focusOnMount={moved}
      onClear={() => choose(undefined)}
    />
  );
}
