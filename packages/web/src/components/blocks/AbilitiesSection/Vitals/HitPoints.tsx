import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  derivedValue,
  hitPointMaximumUnder,
  overrideKey,
  sheetState,
} from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { RollBonusButton } from "../../../RollBonusButton.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";
import { HitPointChange } from "./HitPointChange.tsx";
import { HitPointMaximum } from "./HitPointMaximum.tsx";
import { HitPointRing } from "./HitPointRing.tsx";

const { shape } = characterDerivedSchema;

/**
 * Current and temporary hit points over the maximum in a ring, the maximum's breakdown setting
 * temporary hit points and the reduction, each die's remaining hit dice read against the
 * derived totals by `sheetState`, and beside the ring the controls that apply damage and healing.
 */
export function HitPoints({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
}) {
  const maximum = derivedValue(derived.hitPointMaximum);
  const current = state.hitPoints.current ?? maximum;
  const { temporary } = state.hitPoints;
  const remaining = sheetState(derived, state).hitDice;
  const dice = derived.hitDice.map((pool, index) => ({
    pool,
    remaining: remaining[index]?.remaining ?? 0,
  }));

  return (
    <Card title="Hit Points">
      <div className="flex items-center gap-4">
        <HitPointRing
          current={current}
          temporary={temporary}
          maximum={maximum}
          unreduced={hitPointMaximumUnder(character.definition, derived, null)}
        >
          <span
            aria-hidden="true"
            title={temporary > 0 ? `${current} plus ${temporary} temporary` : undefined}
            className={`font-bold text-[26px] leading-none ${temporary > 0 ? "text-temporary" : ""}`}
          >
            {current + temporary}
          </span>
          <span className="text-muted text-title">
            <span aria-hidden="true">/ </span>
            <HitPointMaximum character={character} derived={derived} state={state} />
          </span>
        </HitPointRing>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <HitPointChange character={character} derived={derived} state={state} />
          {dice.length > 0 && (
            <div className="text-label text-muted">
              <h3 className="font-semibold text-[10px] uppercase tracking-[0.06em]">Hit Dice</h3>
              <ul>
                {dice.map(({ pool, remaining }) => (
                  <li key={pool.die} className="flex items-center gap-1">
                    <span className="min-w-0 flex-1">
                      {remaining}/
                      <DerivedValue
                        named
                        name={`d${pool.die} Hit Dice total`}
                        value={pool.total}
                        format={String}
                        overrideKey={`${overrideKey("hitDice", pool, character.definition)}.total`}
                        schema={shape.hitDice.element.shape.total.shape.computed}
                      />{" "}
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
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
