import { BARDIC_INSPIRATION_DICE } from "@dnd/character";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * The Bardic Inspiration card: the die a bard handed the character, held until a roll uses it
 * or the player clears it. Recording and clearing are each one state write, announced once it
 * lands. The next check, save or attack roll offers the die.
 */
export function BardicInspiration({ characterId }: { characterId: string }) {
  const play = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  if (!play.data) return null;
  const state = play.data.state;
  const held = state.bardicInspiration;
  const busy = replace.writing;

  function record(die: (typeof BARDIC_INSPIRATION_DICE)[number] | null) {
    if (busy) return;
    replace.write(
      { ...state, bardicInspiration: die },
      die === null ? "Bardic Inspiration cleared" : `Bardic Inspiration d${die} held`,
    );
  }

  return (
    <Card
      title="Bardic Inspiration"
      action={
        <button
          type="button"
          aria-disabled={busy || held === null}
          onClick={() => held !== null && record(null)}
          className="font-semibold text-label hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Clear
        </button>
      }
    >
      <p className="mb-1.5 text-row">
        {held === null ? (
          <span className="text-muted">No die held</span>
        ) : (
          <>
            <span className="text-muted">Holding a </span>
            <span className="font-semibold">d{held}</span>
          </>
        )}
      </p>
      <ul className="flex flex-wrap gap-2">
        {BARDIC_INSPIRATION_DICE.map((die) => (
          <li key={die}>
            <button
              type="button"
              aria-pressed={held === die}
              aria-disabled={busy}
              onClick={() => record(die)}
              className={BUTTON}
            >
              d{die}
            </button>
          </li>
        ))}
      </ul>
      <Announcer announced={replace.announced} />
    </Card>
  );
}
