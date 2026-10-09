/**
 * The Hit Points and Status Effects cards, read-only. Current and temporary hit points,
 * hit dice spent and conditions come from the character's state; the maximum and each
 * die's total come from the derived block, and a null current reads as that maximum.
 */
import type { CharacterDerived } from "@dnd/character";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { HitPoints } from "./HitPoints.tsx";
import { StatusEffects } from "./StatusEffects.tsx";

export function Vitals({
  characterId,
  derived,
}: {
  characterId: string;
  derived: CharacterDerived;
}) {
  const state = useCharacterState(characterId);
  if (state.isPending) return <LoadingState label="Loading hit points and conditions…" />;
  if (state.isError) return <ErrorState error={state.error} />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HitPoints derived={derived} state={state.data.state} />
      <StatusEffects state={state.data.state} />
    </div>
  );
}
