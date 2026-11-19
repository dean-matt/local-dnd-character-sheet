import {
  addedActionToggled,
  type CharacterState,
  TURN_LABELS,
  TURN_MARKS,
  turnMarkToggled,
  turnReset,
} from "@dnd/character";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

type Toggle = { key: string; label: string; spent: boolean; toggled: () => CharacterState };

/**
 * The Turn Economy card: whether the action, each action a feature added, the bonus action,
 * reaction and movement are spent this turn. Spent is shown by the word and a strike-through,
 * never colour alone. Each toggle and the reset is one state write, announced once it lands;
 * the reset also drops the added actions.
 */
export function TurnEconomy({ characterId }: { characterId: string }) {
  const play = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  if (!play.data) return null;
  const state = play.data.state;
  const busy = replace.writing;
  const anySpent =
    TURN_MARKS.some((mark) => state.turn[mark]) ||
    state.turn.addedActions.length > 0 ||
    state.turn.features.length > 0;
  const toggles: Toggle[] = TURN_MARKS.flatMap((mark) => [
    {
      key: mark,
      label: TURN_LABELS[mark],
      spent: state.turn[mark],
      toggled: () => turnMarkToggled(state, mark),
    },
    ...(mark === "action"
      ? state.turn.addedActions.map((spent, index) => ({
          key: `action-${index + 2}`,
          label: `${TURN_LABELS.action} ${index + 2}`,
          spent,
          toggled: () => addedActionToggled(state, index),
        }))
      : []),
  ]);

  function toggle({ label, spent, toggled }: Toggle) {
    if (busy) return;
    replace.write(toggled(), `${label} ${spent ? "available" : "spent"}`);
  }

  return (
    <Card
      title="Turn Economy"
      action={
        <button
          type="button"
          aria-disabled={busy || !anySpent}
          onClick={() =>
            anySpent && !busy && replace.write(turnReset(state), "Turn marks reset, all available")
          }
          className="font-semibold text-label hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Reset
        </button>
      }
    >
      <ul className="flex flex-wrap gap-2">
        {toggles.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={item.spent}
              aria-disabled={busy}
              onClick={() => toggle(item)}
              className={`${BUTTON} ${item.spent ? "text-muted line-through" : ""}`}
            >
              {item.label}
              <span className="ml-1.5 font-normal">{item.spent ? "spent" : "available"}</span>
            </button>
          </li>
        ))}
      </ul>
      <Announcer announced={replace.announced} />
    </Card>
  );
}
