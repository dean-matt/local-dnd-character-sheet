import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  derivedValue,
  overrideKey,
  overrideReduction,
  sheetState,
} from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { RollBonusButton } from "../../../RollBonusButton.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";
import { HitPointChange } from "./HitPointChange.tsx";
import { MaximumReduction } from "./MaximumReduction.tsx";

const { shape } = characterDerivedSchema;

/**
 * Current, temporary and each die's remaining hit dice, read against the derived totals by
 * `sheetState`, and the controls that apply damage, healing, temporary hit points and a
 * reduction to the maximum.
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
  const filled = Math.max(0, Math.min(100, Math.round((current / maximum) * 100)));
  const remaining = sheetState(derived, state).hitDice;
  const dice = derived.hitDice.map((pool, index) => ({
    pool,
    remaining: remaining[index]?.remaining ?? 0,
  }));

  return (
    <Card title="Hit Points">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="font-bold text-[26px] leading-none">
            {current}
            <span className="sr-only"> current</span>
          </span>
          <span className="text-muted text-title">
            <span aria-hidden="true">/ </span>
            <span className="sr-only">of </span>
            <DerivedValue
              name="Hit point maximum"
              value={derived.hitPointMaximum}
              format={String}
              overrideKey="hitPointMaximum"
              schema={shape.hitPointMaximum.shape.computed}
              overlay={overrideReduction(character.definition, derived)}
            />
          </span>
          {temporary > 0 && (
            <span
              title="Temporary hit points absorb damage before real hit points"
              className="font-semibold text-positive text-row"
            >
              +{temporary} temp
            </span>
          )}
        </div>
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
        <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
          <div className="h-full bg-accent" style={{ width: `${filled}%` }} />
        </div>
        <HitPointChange character={character} derived={derived} state={state} />
        <MaximumReduction character={character} derived={derived} state={state} />
      </div>
    </Card>
  );
}
