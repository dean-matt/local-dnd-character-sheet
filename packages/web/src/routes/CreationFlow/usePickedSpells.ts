import { type CharacterDefinition, displayName } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useSpellLookup } from "../../hooks/useSpellLookup.ts";
import type { PickedSpell } from "./spellPicks.ts";
import type { useCasterFacts } from "./useCasterFacts.ts";

/**
 * The spells the player picked whose lookup has loaded, each with its level and its
 * standing on `list`, and whether any is still loading. A spell a row gives outright is no
 * pick.
 */
export function usePickedSpells(list: ReturnType<typeof useCasterFacts>["list"]) {
  const spells = useWatch<CharacterDefinition, "spells">({ name: "spells" });
  const picks = (spells ?? []).filter((entry) => !entry.granted);
  const looked = useSpellLookup(
    picks.map((entry) => entry.ref),
    list,
  );
  const picked: PickedSpell[] = picks.flatMap(({ ref }, index) => {
    const found = looked[index];
    if (found === undefined) return [];
    if (found === null) return [{ ref, name: displayName(ref) }];
    const { name, level, listed } = found;
    return [{ ref, name, level, ...(listed !== undefined && { listed }) }];
  });
  return { picked, loading: picked.length < picks.length };
}
