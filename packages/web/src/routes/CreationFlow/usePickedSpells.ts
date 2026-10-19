import { type CharacterDefinition, displayName } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useSpellLookup } from "../../hooks/useSpellLookup.ts";
import { type Offer, type PickedSpell, rowFor, rowPicks } from "./spellPicks.ts";
import type { useCasterFacts } from "./useCasterFacts.ts";

/**
 * The spells the player picked whose lookup has loaded, each with its level and its
 * standing on `list`, or for a pick made for a row, on that row's offer, and whether any is
 * still loading or failed to. A spell a row gives outright is no pick, and a pick made for
 * a row `offers` no longer holds stands on nothing.
 */
export function usePickedSpells(
  list: ReturnType<typeof useCasterFacts>["list"],
  offers: readonly Offer[],
) {
  const spells = useWatch<CharacterDefinition, "spells">({ name: "spells" });
  const picks = (spells ?? []).filter((entry) => !entry.granted);
  const rows = rowPicks(offers, []);
  const contextOf = (index: number) => {
    const pickedFor = picks[index]?.pickedFor;
    if (!pickedFor) return list ? { list } : {};
    const row = rowFor(rows, pickedFor)?.row;
    return row ? { offer: row } : {};
  };
  const { looked, failed } = useSpellLookup(
    picks.map((entry) => entry.ref),
    contextOf,
  );
  const picked: PickedSpell[] = picks.flatMap(({ ref, pickedFor, prepared }, index) => {
    const found = looked[index];
    if (found === undefined) return [];
    const made = { prepared, ...(pickedFor && { pickedFor }) };
    if (found === null) return [{ ref, name: displayName(ref), ...made }];
    const { name, level, listed } = found;
    return [{ ref, name, level, ...(listed !== undefined && { listed }), ...made }];
  });
  return { picked, loading: picked.length < picks.length, failed };
}
