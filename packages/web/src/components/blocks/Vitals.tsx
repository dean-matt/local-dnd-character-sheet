/**
 * The Hit Points and Status Effects cards, read-only. Current and temporary hit points,
 * hit dice spent and conditions come from the character's state; the maximum and each
 * die's total come from the derived block.
 */
import { type CharacterDerived, type CharacterState, derivedValue, refKey } from "@dnd/character";
import { useCharacterState } from "../../hooks/useCharacterState.ts";
import { ErrorState, LoadingState } from "../../states.tsx";
import { Card } from "../Card.tsx";
import { Field } from "../Field.tsx";

/** A die with no pool in state has spent nothing, the way a new character's empty `hitDice` reads. */
function hitDiceRemaining(derived: CharacterDerived, state: CharacterState) {
  return derived.hitDice.map(({ die, total }) => {
    const size = derivedValue(total);
    const pool = state.hitDice.find((candidate) => candidate.die === die);
    return { die, total: size, remaining: Math.min(pool?.remaining ?? size, size) };
  });
}

function HitPoints({ derived, state }: { derived: CharacterDerived; state: CharacterState }) {
  const { current, temporary } = state.hitPoints;
  const maximum = derivedValue(derived.hitPointMaximum);
  const filled = Math.max(0, Math.min(100, Math.round((current / maximum) * 100)));
  const dice = hitDiceRemaining(derived, state);

  return (
    <Card title="Hit Points">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="font-bold text-[26px] leading-none">
            {current}
            <span className="sr-only"> current</span>
          </span>
          <span className="text-muted text-title">
            <span aria-hidden="true">/ </span>
            <span className="sr-only">of </span>
            <Field
              mode="read"
              label="maximum"
              labelHidden
              value={derived.hitPointMaximum}
              format={String}
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
              {dice.map(({ die, total, remaining }, index) => (
                <span key={die}>
                  {index > 0 && ", "}
                  {remaining}/{total} d{die}
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

function StatusEffects({ state }: { state: CharacterState }) {
  const byKey = new Map(state.conditions.map((condition) => [refKey(condition), condition.name]));
  const labels = [...byKey].map(([key, label]) => ({ key, label }));
  if (state.exhaustion > 0) {
    labels.push({ key: "exhaustion", label: `Exhaustion ${state.exhaustion}` });
  }

  return (
    <Card title="Status Effects">
      {labels.length === 0 ? (
        <p className="text-muted text-row italic">No active conditions.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {labels.map(({ key, label }) => (
            <li
              key={key}
              className="rounded-pill border border-border bg-subtle px-2.5 py-1 text-row"
            >
              {label}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Vitals({
  characterId,
  derived,
}: {
  characterId: string;
  derived: CharacterDerived;
}) {
  const state = useCharacterState(characterId);
  if (state.isPending) return <LoadingState label="Loading hit points and conditions…" />;
  if (state.isError) return <ErrorState message={state.error.message} />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HitPoints derived={derived} state={state.data.state} />
      <StatusEffects state={state.data.state} />
    </div>
  );
}
