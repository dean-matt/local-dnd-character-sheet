import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord, EntryRef } from "@dnd/character";
import type { FeaturePickRow } from "../../../lib/featureSpellPicks.ts";
import { searchHitKey } from "../../../lib/searchHitKey.ts";
import { PickField } from "../../PickField.tsx";

const BOOK = "book";

/** The `/search` filters one pick narrows to: its list, and its level or the levels the character can cast. */
function filtersOf({ feature, pick }: FeaturePickRow, ceiling: number): Record<string, string> {
  const level =
    pick.level === undefined
      ? { minLevel: "0", maxLevel: String(ceiling) }
      : { minLevel: String(pick.level), maxLevel: String(pick.level) };
  const list: Record<string, string> =
    pick.from === "any" || pick.from === BOOK
      ? {}
      : { class: `${pick.from}|${feature.classSource}` };
  return { ...level, ...list };
}

/**
 * One spell pick a class or subclass feature leaves to the player, as a field of its own:
 * every spell of its level from its list, or, where it picks from the spellbook, a spell the
 * character already knows. Without a level it takes a cantrip or any level the character
 * casts, `ceiling` at most.
 */
export function FeatureSpellPickField({
  row,
  character,
  ceiling,
  held,
  book,
  onPick,
  onRemove,
}: {
  row: FeaturePickRow;
  character: CharacterRecord;
  ceiling: number;
  held: ReadonlySet<string>;
  book: ReadonlySet<string>;
  onPick: (ref: EntryRef, fromBook: boolean) => void;
  onRemove: (ref: EntryRef, fromBook: boolean) => void;
}) {
  const fromBook = row.pick.from === BOOK;
  const unavailableReason = (hit: SearchHit) => {
    const key = searchHitKey(hit);
    if (fromBook) return book.has(key) ? undefined : "Not in your spellbook";
    return held.has(key) ? "Known already" : undefined;
  };
  const cantrips = row.pick.level === 0;
  const kind = cantrips ? "Cantrips" : row.pick.level ? `Level ${row.pick.level} spells` : "Spells";
  return (
    <PickField
      heading={`${kind} from ${row.feature.name}, level ${row.feature.level}`}
      noun={cantrips ? "cantrip" : "spell"}
      count={row.pick.count}
      picked={row.picked}
      edition={character.edition}
      filters={filtersOf(row, ceiling)}
      unavailableReason={unavailableReason}
      onPick={(ref) => onPick(ref, fromBook)}
      onRemove={(ref) => onRemove(ref, fromBook)}
    />
  );
}
