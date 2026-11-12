import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  derivedValue,
  overrideKey,
  sheetState,
} from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { RollBonusButton } from "../../../RollBonusButton.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";

const { shape } = characterDerivedSchema;

/** Renders nothing for a character with no hit dice pools. */
export function HitDice({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  if (derived.hitDice.length === 0) return null;
  const remaining = sheetState(derived, state).hitDice;

  return (
    <Card title="Hit Dice">
      <ul className="flex flex-col gap-1">
        {derived.hitDice.map((pool, index) => (
          <li key={pool.die} className="flex items-center gap-2 text-row">
            <span className="min-w-0 flex-1">
              <span className="font-bold">{remaining[index]?.remaining ?? 0}</span>
              <span className="text-muted">
                {" / "}
                <DerivedValue
                  named
                  name={`d${pool.die} Hit Dice total`}
                  value={pool.total}
                  format={String}
                  overrideKey={`${overrideKey("hitDice", pool, character.definition)}.total`}
                  schema={shape.hitDice.element.shape.total.shape.computed}
                />
              </span>{" "}
              d{pool.die}
            </span>
            <span className="flex w-6 justify-center">
              <RollBonusButton
                label={`d${pool.die} Hit Die`}
                type="hit-die"
                dice={`1d${pool.die}`}
                bonus={derivedValue(derived.abilityModifiers.con)}
              />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
