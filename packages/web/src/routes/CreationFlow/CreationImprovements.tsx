import type { CharacterDefinition } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useImprovementGrants } from "../../hooks/useImprovementGrants.ts";
import { reconcileImprovements } from "./reconcileImprovements.ts";

/**
 * Keeps each improvement's choice in step with the classes, on every step, so a level
 * lowered on the Class step never carries a choice it no longer grants to Finish.
 */
export function CreationImprovements() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const [levels = [], edition = "one"] = useWatch<CharacterDefinition, ["levels", "edition"]>({
    name: ["levels", "edition"],
  });
  const { grants, read } = useImprovementGrants(levels);
  const key = JSON.stringify([read, grants, edition]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `read`, `grants` and `edition`, rebuilt each render.
  useEffect(() => {
    if (!read) return;
    const held = {
      feats: getValues("feats") ?? [],
      abilityIncreases: getValues("abilityIncreases") ?? [],
    };
    const next = reconcileImprovements(held, grants, edition);
    if (next.feats !== held.feats) setValue("feats", next.feats, { shouldDirty: true });
    if (next.abilityIncreases !== held.abilityIncreases)
      setValue("abilityIncreases", next.abilityIncreases, { shouldDirty: true });
  }, [key]);

  return null;
}
