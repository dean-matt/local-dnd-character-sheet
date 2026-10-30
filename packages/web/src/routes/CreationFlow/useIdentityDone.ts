import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { raceChoices } from "../../lib/raceChoices.ts";
import { heldFromBackground } from "./backgroundFeats.ts";
import { stepOf } from "./creationSteps.ts";
import { useBackgroundFeats } from "./useBackgroundFeats.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

/**
 * Whether the Identity step is finished: Finish would find no fault in a value it sets, and
 * the race leaves nothing open — a subrace where it has subraces and no plain variant, a
 * size where it offers more than one, a resistance where it offers a choice. A typed race
 * leaves nothing to ask. A background offering a choice of feats waits for its pick.
 */
export function useIdentityDone(): boolean {
  const values = useWatch<CharacterDefinition>();
  const { catalogRace, subraces, subraceRow, raceJson, raceRead } = useIdentityCatalog();
  const backgroundFeats = useBackgroundFeats();
  const parsed = characterDefinitionSchema.safeParse(values);
  const faulted = parsed.error?.issues.some(
    (issue) => stepOf(String(issue.path[0] ?? ""))?.slug === "identity",
  );
  if (faulted) return false;
  const { offers, feats } = backgroundFeats;
  if (
    offers &&
    !offers.fixed &&
    offers.options.length > 0 &&
    heldFromBackground(feats).length === 0
  )
    return false;
  if (!raceRead) return false;
  const rows = subraces.data?.items ?? [];
  if (
    catalogRace &&
    (values.subrace
      ? subraceRow === undefined
      : rows.length > 0 && !rows.some((row) => row.name === ""))
  )
    return false;
  const { sizes, resistances } = raceChoices(raceJson);
  if (sizes.length > 0 && !sizes.some((size) => size === values.size)) return false;
  return resistances.length === 0 || resistances.includes(values.raceResistance ?? "");
}
