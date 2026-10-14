import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useState } from "react";
import { searchHitKey } from "../../../../lib/searchHitKey.ts";
import { spellListFilters } from "../../../../lib/spellListFilters.ts";
import { SpellPickField } from "../../../SpellPickField.tsx";
import type { useLevelUpSpells } from "./useLevelUpSpells.ts";

export interface LevelUpSpellsProps {
  edition: CharacterDefinition["edition"];
  className: string;
  picks: ReturnType<typeof useLevelUpSpells>;
}

/**
 * The cantrips and spells the level adds, each picked from the class's list at the levels
 * its slots cast after the level. A section shows only where the level adds to its count.
 * The escape offers every spell of every level, for a pick the class's own list cannot
 * hold, as a bard's Magical Secrets.
 */
export function LevelUpSpells({ edition, className, picks }: LevelUpSpellsProps) {
  const [beyond, setBeyond] = useState(false);
  const { gained, list, known, failed } = picks;
  if (gained.cantrips === 0 && gained.spells === 0) return null;
  const picked = new Set([...picks.cantrips, ...picks.spells].map((pick) => entryKey(pick.ref)));
  const unavailableReason = (hit: SearchHit) => {
    if (known.has(searchHitKey(hit))) return "Known already";
    return picked.has(searchHitKey(hit)) ? "Picked already" : undefined;
  };
  const filters = spellListFilters(list, beyond);
  const field = { edition, unavailableReason, onPick: picks.add, onRemove: picks.remove };
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
          filters={{
            minLevel: "1",
            maxLevel: String(beyond ? 9 : Math.max(1, gained.maxLevel)),
            ...filters,
          }}
        />
      )}
      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={beyond} onChange={() => setBeyond(!beyond)} />
        Offer spells off the {className} list, and of any level
      </label>
      {failed && <p className="text-error">Couldn't look up the spells picked.</p>}
    </>
  );
}
