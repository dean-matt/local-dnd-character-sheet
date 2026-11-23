import type { SearchHit } from "@dnd/catalog";
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { searchHitKey } from "../../../lib/searchHitKey.ts";
import { Card } from "../../Card.tsx";
import { RowPickFields } from "../../RowPickFields.tsx";
import { SpellBlockChoices } from "../../SpellBlockChoices.tsx";
import { FeatureSpellPickField } from "./FeatureSpellPickField.tsx";
import { useOwedSpellPicks } from "./useOwedSpellPicks.ts";

/** The highest level a slot or pact slot casts, an upper bound on one class's where several are held. */
const ceilingOf = ({ spellSlots, pactSlots }: Pick<CharacterDerived, "spellSlots" | "pactSlots">) =>
  Math.max(0, pactSlots?.level ?? 0, ...spellSlots.map(({ level }) => level));

/**
 * The spells a feat, optional feature or class feature the character holds leaves to a
 * pick, such as Magic Initiate's cantrips, Pact of the Tome's or Mystic Arcanum's, each
 * chosen from the offer's own list and kept under the feature that gave it. Its alternative
 * blocks, as Magic Initiate's classes, are chosen first. Nothing draws once every pick is
 * made; they are then in Known Spells.
 */
export function OwedSpellPicks({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: Pick<CharacterDerived, "spellSlots" | "pactSlots">;
}) {
  const {
    rows,
    featureRows,
    choosing,
    held,
    book,
    ready,
    failed,
    chooseBlock,
    add,
    remove,
    pickForFeature,
    unpickForFeature,
  } = useOwedSpellPicks(character);
  if (!failed && !ready) return null;
  if (rows.length === 0 && featureRows.length === 0 && choosing.length === 0 && !failed) {
    return null;
  }
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
        {featureRows.map((row) => (
          <FeatureSpellPickField
            key={`${row.feature.name}|${row.feature.level}|${row.pick.level}|${row.pick.from}`}
            row={row}
            character={character}
            ceiling={ceilingOf(derived)}
            held={held}
            book={book}
            onPick={(ref, fromBook) => pickForFeature(ref, row.pickedFor, fromBook)}
            onRemove={(ref, fromBook) => unpickForFeature(ref, row.pickedFor, fromBook)}
          />
        ))}
        {failed && <p className="text-error">Couldn't look up the spells these picks offer.</p>}
      </div>
    </Card>
  );
}
