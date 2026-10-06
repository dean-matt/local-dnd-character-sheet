import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { stepOf } from "./creationSteps.ts";
import { raceChoices } from "./raceChoices.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

/**
 * Whether the Identity step is finished: Finish would find no fault in a value it sets, and
 * the race leaves nothing open — a subrace where it has subraces and no plain variant, a
 * size where it offers more than one, a resistance where it offers a choice. A race the
 * catalog does not hold leaves nothing to ask.
 */
export function useIdentityDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const { catalogRace, raceRow, subraces, subraceRow, raceJson } = useIdentityCatalog();
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "identity",
  );
  if (faulted) return false;
  if (catalogRace === undefined) return true;
  if (raceRow.data === undefined || subraces.data === undefined) return false;
  const rows = subraces.data.items;
  if (
    values.subrace
      ? subraceRow === undefined
      : rows.length > 0 && !rows.some((row) => row.name === "")
  )
    return false;
  const { sizes, resistances } = raceChoices(raceJson);
  if (sizes.length > 0 && !sizes.some((size) => size === values.size)) return false;
  return resistances.length === 0 || resistances.includes(values.raceResistance ?? "");
}
