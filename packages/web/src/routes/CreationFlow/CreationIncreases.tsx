import type { CharacterDefinition } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { readPicks } from "../../lib/increasePicks.ts";
import { increasesOf, withIncreases } from "./grantorIncreases.ts";
import { useIncreaseOptions } from "./useIncreaseOptions.ts";

/**
 * Keeps each grantor's stored increases in step with its row, on every step, so a race
 * changed on Identity never carries the old race's increases to Finish. Increases the row
 * still explains stay, so a reload keeps the player's picks; any it does not are replaced
 * by what the row fixes, where it offers one way to take them, or by none.
 */
export function CreationIncreases() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const increases = useWatch<CharacterDefinition, "abilityIncreases">({ name: "abilityIncreases" });
  const sources = useIncreaseOptions();
  const key = JSON.stringify([sources, increases]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `sources` and `increases`, rebuilt each render.
  useEffect(() => {
    if (sources === undefined) return;
    let next = getValues("abilityIncreases") ?? [];
    for (const { grantedBy, alternatives } of sources) {
      const mine = next.filter((increase) => increase.grantedBy === grantedBy);
      if (readPicks(alternatives, mine)) continue;
      const fixed =
        alternatives.length === 1
          ? increasesOf(alternatives, { alternative: 0, slots: [] }, grantedBy)
          : [];
      next = withIncreases(next, grantedBy, fixed);
    }
    if (JSON.stringify(next) !== JSON.stringify(getValues("abilityIncreases") ?? []))
      setValue("abilityIncreases", next, { shouldDirty: true });
  }, [key]);

  return null;
}
