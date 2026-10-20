import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, entryKey } from "@dnd/character";
import { useState } from "react";
import { searchHitKey } from "../../../../lib/searchHitKey.ts";
import { spellListFilters } from "../../../../lib/spellListFilters.ts";
import { spellOfferFilters } from "../../../../lib/spellOfferFilters.ts";
import { PickField } from "../../../PickField.tsx";
import type { useLevelUpSpells } from "./useLevelUpSpells.ts";

export interface LevelUpSpellsProps {
  edition: CharacterDefinition["edition"];
  className: string;
  picks: ReturnType<typeof useLevelUpSpells>;
}

/**
 * The cantrips and spells the level adds, each picked from the class's list at the levels
 * its slots cast after the level. A section shows only where the level adds to its count.
 * A subclass's features that let the character choose spells add a section of their own,
 * narrowed to the list and spell levels the feature names. The escape offers every spell of
 * every level, for a pick the class's own list cannot hold, as a bard's Magical Secrets.
 */
export function LevelUpSpells({ edition, className, picks }: LevelUpSpellsProps) {
  const [beyond, setBeyond] = useState(false);
  const { gained, offered, offer, spellbook, list, known, failed } = picks;
  const by = picks.subclassName;
  const subclassOwes = offered.cantrips + offered.spells > 0;
  if (gained.cantrips === 0 && gained.spells === 0 && !subclassOwes) return null;
  const picked = new Set(
    [...picks.cantrips, ...picks.spells, ...picks.subclassCantrips, ...picks.subclassSpells].map(
      (pick) => entryKey(pick.ref),
    ),
  );
  const unavailableReason = (hit: SearchHit) => {
    if (known.has(searchHitKey(hit))) return "Known already";
    return picked.has(searchHitKey(hit)) ? "Picked already" : undefined;
  };
  const filters = spellListFilters(list, beyond);
  const field = { edition, unavailableReason, onPick: picks.add, onRemove: picks.remove };
  const offerField = { ...field, onPick: picks.addSubclass };
  const offerFilters = offer ? spellOfferFilters(offer, beyond) : {};
  return (
    <>
      {gained.cantrips > 0 && (
        <PickField
          {...field}
          heading="New cantrips"
          noun="cantrip"
          count={gained.cantrips}
          picked={picks.cantrips}
          filters={{ minLevel: "0", maxLevel: "0", ...filters }}
        />
      )}
      {gained.spells > 0 && (
        <PickField
          {...field}
          heading={spellbook ? "Spells for your spellbook" : "New spells"}
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
      {offered.cantrips > 0 && (
        <PickField
          {...offerField}
          heading={`Cantrips from ${by}`}
          noun="cantrip"
          count={offered.cantrips}
          picked={picks.subclassCantrips}
          filters={{ minLevel: "0", maxLevel: "0", ...offerFilters }}
        />
      )}
      {offered.spells > 0 && (
        <PickField
          {...offerField}
          heading={`Spells from ${by}`}
          noun="spell"
          count={offered.spells}
          picked={picks.subclassSpells}
          filters={{ minLevel: "1", maxLevel: "9", ...offerFilters }}
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
