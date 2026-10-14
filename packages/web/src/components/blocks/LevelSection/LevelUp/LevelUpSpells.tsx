import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, entryKey } from "@dnd/character";
import { SpellPickField } from "../../../SpellPickField.tsx";
import type { useLevelUpSpells } from "./useLevelUpSpells.ts";

const hitKey = (hit: SearchHit) =>
  entryKey("id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source });

const nameSource = (ref: { name: string; source: string }) => `${ref.name}|${ref.source}`;

export interface LevelUpSpellsProps {
  edition: CharacterDefinition["edition"];
  picks: ReturnType<typeof useLevelUpSpells>;
}

/**
 * The cantrips and spells the level adds, each picked from the class's list at the levels
 * its slots cast after the level. A section shows only where the level adds to its count.
 */
export function LevelUpSpells({ edition, picks }: LevelUpSpellsProps) {
  const { gained, list, known, failed } = picks;
  if (gained.cantrips === 0 && gained.spells === 0) return null;
  const picked = new Set([...picks.cantrips, ...picks.spells].map((pick) => entryKey(pick.ref)));
  const unavailableReason = (hit: SearchHit) => {
    if (known.has(hitKey(hit))) return "Known already";
    return picked.has(hitKey(hit)) ? "Picked already" : undefined;
  };
  const filters = list
    ? {
        class: nameSource(list.class),
        ...(list.subclass && { subclass: nameSource(list.subclass) }),
        classLevel: String(list.level),
      }
    : {};
  const field = {
    edition,
    unavailableReason,
    onPick: picks.add,
    onRemove: picks.remove,
  };
  return (
    <>
      {gained.cantrips > 0 && (
        <SpellPickField
          {...field}
          heading="New cantrips"
          noun="cantrip"
          count={gained.cantrips}
          picked={picks.cantrips}
          filters={{ minLevel: "0", maxLevel: "0", ...filters }}
        />
      )}
      {gained.spells > 0 && (
        <SpellPickField
          {...field}
          heading="New spells"
          noun="spell"
          count={gained.spells}
          picked={picks.spells}
          filters={{ minLevel: "1", maxLevel: String(Math.max(1, gained.maxLevel)), ...filters }}
        />
      )}
      {failed && <p className="text-error">Couldn't look up the spells picked.</p>}
    </>
  );
}
