import type { ReactNode } from "react";
import { HomebrewPreview } from "./HomebrewPreview.tsx";
import { HomebrewProblemAlert } from "./HomebrewProblemAlert.tsx";
import { errorFor, type HomebrewProblem } from "./homebrewDraft.ts";
import { type HomebrewKind, stepOf } from "./homebrewKinds.ts";
import type { useHomebrewEntryDraft } from "./useHomebrewEntryDraft.ts";

export interface HomebrewStepModeProps {
  kind: HomebrewKind;
  step: number;
  draft: ReturnType<typeof useHomebrewEntryDraft>;
  settings: ReactNode;
  problems: HomebrewProblem[];
  /** The problems to name, which stay empty until a step or a save is tried. */
  shownProblems: HomebrewProblem[];
  onStep: (step: number) => void;
}

/**
 * A button naming each step, one step of the kind's form with the problems in fields it has
 * no control for, and past the last step, the review.
 */
export function HomebrewStepMode({
  kind,
  step,
  draft,
  settings,
  problems,
  shownProblems,
  onStep,
}: HomebrewStepModeProps) {
  const current = kind.steps[step];
  const titles = [...kind.steps.map(({ title }) => title), "Review"];
  return (
    <>
      <nav aria-label="Steps">
        <ol className="flex flex-wrap gap-1">
          {titles.map((title, index) => (
            <li key={title}>
              <button
                type="button"
                aria-current={index === step ? "step" : undefined}
                onClick={() => onStep(index)}
                className="rounded-control border border-border px-3 py-1 text-muted text-row hover:bg-subtle aria-[current=step]:bg-subtle aria-[current=step]:font-semibold aria-[current=step]:text-ink"
              >
                {title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <p aria-live="polite" className="text-label text-muted">
        Step {step + 1} of {kind.steps.length + 1}
      </p>
      {current ? (
        <>
          <h3 className="font-semibold text-sm">{current.title}</h3>
          {step === 0 && settings}
          <current.Fields
            key={draft.revision}
            entry={draft.entry}
            edition={draft.edition}
            onChange={draft.edit}
            errorFor={(key) => errorFor(shownProblems, key)}
          />
          <HomebrewProblemAlert
            problems={shownProblems.filter(
              ({ key }) => stepOf(kind, key) === step && !kind.formKeys.includes(key),
            )}
          />
        </>
      ) : (
        <>
          <h3 className="font-semibold text-sm">Review</h3>
          <HomebrewProblemAlert problems={problems} />
          <HomebrewPreview noun={kind.noun} shown={draft.shown} />
        </>
      )}
    </>
  );
}
