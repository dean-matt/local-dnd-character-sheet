import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { searchHitKey } from "../../../lib/searchHitKey.ts";
import { Card } from "../../Card.tsx";
import { RowPickFields } from "../../RowPickFields.tsx";
import { SpellBlockChoices } from "../../SpellBlockChoices.tsx";
import { useOwedSpellPicks } from "./useOwedSpellPicks.ts";

/**
 * The spells a feat or optional feature the character holds leaves to a pick, such as Magic
 * Initiate's cantrips or Pact of the Tome's, each chosen from the offer's own list and kept
 * under the feature that gave it. Its alternative blocks, as Magic Initiate's classes, are
 * chosen first. Nothing draws once every pick is made; they are then in Known Spells.
 */
export function OwedSpellPicks({ character }: { character: CharacterRecord }) {
  const { rows, choosing, held, failed, chooseBlock, add, remove } = useOwedSpellPicks(character);
  if (rows.length === 0 && choosing.length === 0) return null;
  const unavailableReason = (hit: SearchHit) =>
    held.has(searchHitKey(hit)) ? "Known already" : undefined;
  return (
    <Card title="Spell Picks">
      <div className="flex flex-col gap-4">
        <SpellBlockChoices offers={choosing} onChoose={chooseBlock} />
        {rows.map((row) => (
          <RowPickFields
            key={`${row.pickedFor.kind}|${row.row.ref.name}|${row.row.ref.source}`}
            row={row}
            field={{
              edition: character.edition,
              unavailableReason,
              onRemove: (ref) => remove(ref, row.pickedFor),
            }}
            offList={false}
            onPick={add}
          />
        ))}
        {failed && <p className="text-error">Couldn't look up the spells these picks offer.</p>}
      </div>
    </Card>
  );
}
