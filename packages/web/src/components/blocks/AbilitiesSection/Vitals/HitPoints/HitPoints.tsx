import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  derivedValue,
  overrideKey,
  type RestLength,
  sheetState,
} from "@dnd/character";
import { useState } from "react";
import { Card } from "../../../../Card.tsx";
import { DerivedValue } from "../../../DerivedValue.tsx";
import { RestButton } from "./RestButton.tsx";

const { shape } = characterDerivedSchema;

const RESTS: RestLength[] = ["short", "long"];

/**
 * Current, temporary and each die's remaining hit dice, read against the derived totals by
 * `sheetState`, and the controls that take a rest. A rest applied is announced, since its
 * dialog closes on it.
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
  const [applied, setApplied] = useState<string>();

  return (
    <Card
      title="Hit Points"
      action={
        <span className="flex items-center gap-0.5">
          {RESTS.map((length) => (
            <RestButton
              key={length}
              character={character}
              derived={derived}
              state={state}
              length={length}
              onApplied={setApplied}
            />
          ))}
        </span>
      }
    >
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
          {dice.length > 0 && (
            <span className="ml-auto text-label text-muted">
              Hit Dice{" "}
              {dice.map(({ pool, remaining }, index) => (
                <span key={pool.die}>
                  {index > 0 && ", "}
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
              ))}
            </span>
          )}
        </div>
        <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
          <div className="h-full bg-accent" style={{ width: `${filled}%` }} />
        </div>
        {/* Mounted while empty: a live region added with its text is often not announced. */}
        <p role="status" className="sr-only">
          {applied}
        </p>
      </div>
    </Card>
  );
}
