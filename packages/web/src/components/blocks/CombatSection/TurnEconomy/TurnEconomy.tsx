import { TURN_LABELS, TURN_MARKS, type TurnMark, turnMarkToggled, turnReset } from "@dnd/character";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * The Turn Economy card: whether the action, bonus action, reaction and movement are spent this
 * turn. Spent is shown by the word and a strike-through, never colour alone. Each toggle and the
 * reset is one state write, announced once it lands.
 */
export function TurnEconomy({ characterId }: { characterId: string }) {
  const play = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  if (!play.data) return null;
  const state = play.data.state;
  const busy = replace.writing;
  const anySpent = TURN_MARKS.some((mark) => state.turn[mark]);

  function toggle(mark: TurnMark) {
    if (busy) return;
    const spent = !state.turn[mark];
    replace.write(
      turnMarkToggled(state, mark),
      `${TURN_LABELS[mark]} ${spent ? "spent" : "available"}`,
    );
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
        {TURN_MARKS.map((mark) => {
          const spent = state.turn[mark];
          return (
            <li key={mark}>
              <button
                type="button"
                aria-pressed={spent}
                aria-disabled={busy}
                onClick={() => toggle(mark)}
                className={`${BUTTON} ${spent ? "text-muted line-through" : ""}`}
              >
                {TURN_LABELS[mark]}
                <span className="ml-1.5 font-normal">{spent ? "spent" : "available"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Announcer announced={replace.announced} />
    </Card>
  );
}
