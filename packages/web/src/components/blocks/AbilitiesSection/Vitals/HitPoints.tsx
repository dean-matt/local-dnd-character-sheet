import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  derivedValue,
  overrideKey,
} from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";

const { shape } = characterDerivedSchema;

/** A die with no pool in state has spent nothing, the way a new character's empty `hitDice` reads. */
function hitDiceRemaining(derived: CharacterDerived, state: CharacterState) {
  return derived.hitDice.map((pool) => {
    const size = derivedValue(pool.total);
    const spent = state.hitDice.find((candidate) => candidate.die === pool.die);
    return { pool, remaining: Math.min(spent?.remaining ?? size, size) };
  });
}

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
  const dice = hitDiceRemaining(derived, state);

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
      </div>
    </Card>
  );
}
