import { isRaging } from "@dnd/character";
import { useCharacterState } from "../../../hooks/useCharacterState.ts";

/** Says a raging character can't cast or concentrate; informational, it disables nothing. */
export function RagingNote({ id }: { id: string }) {
  const state = useCharacterState(id);
  if (!state.data || !isRaging(state.data.state)) return null;
  return (
    <p className="text-accent-text text-label">Can't cast spells or concentrate while raging.</p>
  );
}
