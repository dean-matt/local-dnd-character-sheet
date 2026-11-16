/** The controls a player reaches for every turn of a fight; the reference numbers stay on Abilities. */
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { EmptyState } from "../../../EmptyState.tsx";
import { Actions } from "./Actions/Actions.tsx";
import { Attacks } from "./Attacks/Attacks.tsx";
import { BardicInspiration } from "./BardicInspiration/BardicInspiration.tsx";
import { Encounter } from "./Encounter/Encounter.tsx";
import { TurnEconomy } from "./TurnEconomy/TurnEconomy.tsx";

export function CombatSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character || !derived) return <EmptyState>Combat isn't available yet.</EmptyState>;
  return (
    <div className="flex flex-col gap-3">
      <Encounter character={character} derived={derived} />
      <TurnEconomy characterId={character.id} />
      <BardicInspiration characterId={character.id} />
      <Actions character={character} derived={derived} />
      <Attacks character={character} derived={derived} />
    </div>
  );
}
