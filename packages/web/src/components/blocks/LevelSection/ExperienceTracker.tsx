import { type CharacterRecord, experienceThreshold, totalLevel } from "@dnd/character";
import { type FormEvent, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";

const MAX_LEVEL = 20;

const xp = (points: number) => `${points.toLocaleString("en-US")} XP`;

/**
 * The experience total against its level's band, and a field that adds to the total or,
 * given a negative amount, takes from it. Enough experience earns a note, never a level.
 */
export function ExperienceTracker({ character }: { character: CharacterRecord }) {
  const update = useUpdateCharacterDefinition(character.id);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(0);
  const { experience } = character.definition;
  const level = totalLevel(character.definition);
  const next = level < MAX_LEVEL ? experienceThreshold(level + 1) : undefined;
  const floor = experienceThreshold(level);
  const amount = Number(draft);
  const valid = draft.trim() !== "" && Number.isSafeInteger(amount) && amount !== 0;

  const filled =
    next === undefined
      ? 100
      : Math.max(0, Math.min(100, Math.round(((experience - floor) / (next - floor)) * 100)));
  const caption =
    next === undefined
      ? `Level ${MAX_LEVEL} — no further experience needed.`
      : experience >= next
        ? "Enough XP to level up."
        : `${xp(next - experience)} to Level ${level + 1}`;

  function apply(delta: number) {
    setSent(delta);
    update.mutate((latest) => ({
      ...latest,
      experience: Math.max(0, latest.experience + delta),
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    apply(amount);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-label text-muted">
        <span>{xp(experience)}</span>
        <span>{next === undefined ? "Max level" : xp(next)}</span>
      </div>
      <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-pill bg-subtle">
        <div className="h-full bg-accent" style={{ width: `${filled}%` }} />
      </div>
      <p className="text-label text-muted">{caption}</p>
      <form noValidate onSubmit={submit} className="mt-1 flex items-start gap-1.5">
        <div className="grow">
          <InputField
            label="Adjust experience points, negative to remove"
            labelHidden
            type="number"
            step={1}
            placeholder="± XP"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            status={update.isPending ? "Saving…" : null}
            error={
              update.isError && (
                <SaveFailure
                  message={`Couldn't save ${sent > 0 ? "+" : ""}${xp(sent)}: ${update.error.message}`}
                  onRetry={() => apply(sent)}
                />
              )
            }
            className="w-full text-row"
          />
        </div>
        <button
          type="submit"
          disabled={!valid}
          className="rounded-control bg-accent px-3 py-1 font-semibold text-row text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
