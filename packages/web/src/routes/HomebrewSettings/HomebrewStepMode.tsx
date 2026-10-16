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
}

/**
 * One step of the kind's form, with the problems in fields it has no control for; past the
 * last step, the review.
 */
export function HomebrewStepMode({
  kind,
  step,
  draft,
  settings,
  problems,
  shownProblems,
}: HomebrewStepModeProps) {
  const current = kind.steps[step];
  return (
    <>
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
