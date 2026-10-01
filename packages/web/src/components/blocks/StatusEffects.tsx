import type { CharacterState } from "@dnd/character";
import { Card } from "../Card.tsx";
import { ChipList } from "../ChipList.tsx";

export function StatusEffects({ state }: { state: CharacterState }) {
  // A chip shows the name alone, so one condition held from two sources reads as one chip.
  const names = new Set(state.conditions.map((condition) => condition.name));
  const labels = [...names];
  if (state.exhaustion > 0) labels.push(`Exhaustion ${state.exhaustion}`);

  return (
    <Card title="Status Effects">
      <ChipList labels={labels} empty="No active conditions." />
    </Card>
  );
}
