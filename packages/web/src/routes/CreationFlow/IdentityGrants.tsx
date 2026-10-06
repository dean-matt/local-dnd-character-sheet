import { type ProficiencyGrants, proficiencyGrantsSchema } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { type Granted, NO_GRANTS, resolveGrants, swapGrants } from "./grants.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

/**
 * Lands what the race and background grant outright in the definition's proficiencies, and
 * takes back what a replaced one granted. It waits until every row a grant reads has
 * loaded, so a half-read or failed read never drops a proficiency. What it last landed lives only
 * as long as the flow: after a reload it starts from nothing, which re-adds what is already
 * held and removes nothing.
 */
export function IdentityGrants() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { edition, catalogRace, raceRow, subraces, raceJson, backgroundRow, backgrounds, names } =
    useIdentityCatalog();
  // A failed read waits too: resolving against a missing list would drop what it granted.
  const raceRead = catalogRace === undefined || (raceRow.isSuccess && subraces.isSuccess);
  const loading = !(raceRead && backgrounds.isSuccess && names.isSuccess);
  const sources: ProficiencyGrants[] = [raceJson, backgroundRow?.json].flatMap((json) =>
    json ? [proficiencyGrantsSchema.parse(json)] : [],
  );
  const granted = loading ? undefined : resolveGrants(sources, names.data?.items ?? [], edition);
  const key = JSON.stringify(granted);
  const landed = useRef<Granted>(NO_GRANTS);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `granted`, rebuilt each render.
  useEffect(() => {
    if (granted === undefined) return;
    const before = landed.current;
    landed.current = granted;
    if (JSON.stringify(before) === key) return;
    setValue("proficiencies", swapGrants(getValues("proficiencies"), before, granted), {
      shouldDirty: true,
    });
  }, [key]);

  return null;
}
