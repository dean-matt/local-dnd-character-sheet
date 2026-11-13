import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  derivedValue,
  hitPointMaximumUnder,
} from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { HitPointChange } from "./HitPointChange.tsx";
import { HitPointMaximum } from "./HitPointMaximum.tsx";
import { HitPointRing } from "./HitPointRing.tsx";

/**
 * Current and temporary hit points over the maximum in a ring, the maximum's breakdown setting
 * temporary hit points and the reduction, and beside the ring the controls that apply damage
 * and healing.
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
        <div className="min-w-0">
          <HitPointChange character={character} derived={derived} state={state} />
        </div>
      </div>
    </Card>
  );
}
