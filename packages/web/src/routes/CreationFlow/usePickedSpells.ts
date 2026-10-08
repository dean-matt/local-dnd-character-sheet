import { type CharacterDefinition, displayName } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useSpellLookup } from "../../hooks/useSpellLookup.ts";
import type { PickedSpell } from "./spellPicks.ts";
import type { useCasterFacts } from "./useCasterFacts.ts";
import { useSpellGrantors } from "./useSpellGrantors.ts";

/** The rows whose own picks a spell may be: every grantor but the class, whose list is `list`. */
function useOfferedBy() {
  return useSpellGrantors()
    .filter(({ grantor }) => grantor !== "class" && grantor !== "subclass")
    .map(({ grantor, ref, parent, level }) => ({ grantor, ref, level, ...(parent && { parent }) }));
}

/**
 * The spells the player picked whose lookup has loaded, each with its level, its standing
 * on `list` and whether another row offers it, and whether any is still loading or failed
 * to. A spell a row gives outright is no pick.
 */
export function usePickedSpells(list: ReturnType<typeof useCasterFacts>["list"]) {
  const spells = useWatch<CharacterDefinition, "spells">({ name: "spells" });
  const picks = (spells ?? []).filter((entry) => !entry.granted);
  const offeredBy = useOfferedBy();
  const { looked, failed } = useSpellLookup(
    picks.map((entry) => entry.ref),
    { ...(list && { list }), ...(offeredBy.length > 0 && { offeredBy }) },
  );
  const picked: PickedSpell[] = picks.flatMap(({ ref }, index) => {
    const found = looked[index];
    if (found === undefined) return [];
    if (found === null) return [{ ref, name: displayName(ref) }];
    const { name, level, listed, offered } = found;
    return [
      {
        ref,
        name,
        level,
        ...(listed !== undefined && { listed }),
        ...(offered !== undefined && { offered }),
      },
    ];
  });
  return { picked, loading: picked.length < picks.length, failed };
}
