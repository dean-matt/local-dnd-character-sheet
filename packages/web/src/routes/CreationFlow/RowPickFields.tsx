import type { EntryRef } from "@dnd/character";
import { PickField, type PickFieldProps } from "../../components/PickField.tsx";
import { cantripsOf, type PickGrantor, type RowPicks, spellsOf } from "./spellPicks.ts";

const nameSource = (ref: { name: string; source: string }) => `${ref.name}|${ref.source}`;

/** The `/search` filters narrowing a picker to what `row` leaves to a pick, none `offList`. */
const offerFilters = ({ grantor, ref, parent, level, block }: RowPicks["row"], offList: boolean) =>
  offList
    ? {}
    : {
        offerGrantor: grantor,
        offer: nameSource(ref),
        ...(parent && { offerParent: nameSource(parent) }),
        offerLevel: String(level),
        ...(block !== undefined && { offerBlock: String(block) }),
      };

/**
 * The picks one row offers apart from the class's, each kind it offers or already holds a
 * pick of, its pickers narrowed to the row's offer unless `offList`. Alternative blocks owe
 * none, so their count is the largest block's.
 */
export function RowPickFields({
  row,
  field,
  offList,
  onPick: pickFor,
}: {
  row: RowPicks;
  field: Pick<PickFieldProps, "edition" | "unavailableReason" | "onRemove">;
  offList: boolean;
  onPick: (ref: EntryRef, pickedFor: PickGrantor) => void;
}) {
  const onPick = (ref: EntryRef) => pickFor(ref, row.pickedFor);
  const by = row.row.ref.name;
  const filters = offerFilters(row.row, offList);
  const cantrips = cantripsOf(row.picked);
  const spells = spellsOf(row.picked);
  const alternatives = row.owed.cantrips + row.owed.spells === 0;
  const note = alternatives ? (
    <p className="text-muted text-row">
      The most any of {by}'s options offers; choose which applies above.
    </p>
  ) : undefined;
  return (
    <>
      {(row.counts.cantrips > 0 || cantrips.length > 0) && (
        <PickField
          {...field}
          heading={`Cantrips from ${by}`}
          noun="cantrip"
          count={row.counts.cantrips}
          note={note}
          picked={cantrips}
          filters={{ minLevel: "0", maxLevel: "0", ...filters }}
          onPick={onPick}
        />
      )}
      {(row.counts.spells > 0 || spells.length > 0) && (
        <PickField
          {...field}
          heading={`Spells from ${by}`}
          noun="spell"
          count={row.counts.spells}
          note={note}
          picked={spells}
          filters={{ minLevel: "1", maxLevel: "9", ...filters }}
          onPick={onPick}
        />
      )}
    </>
  );
}
