import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { HomebrewProblemAlert } from "./HomebrewProblemAlert.tsx";
import { errorFor, type HomebrewProblem } from "./homebrewDraft.ts";
import { type HomebrewKind, stepOf } from "./homebrewKinds.ts";
import type { useHomebrewEntryDraft } from "./useHomebrewEntryDraft.ts";

export interface HomebrewStepModeProps {
  kind: HomebrewKind;
  step: number;
  draft: ReturnType<typeof useHomebrewEntryDraft>;
  settings: ReactNode;
  /** The problems to name, which stay empty until a step or a save is tried. */
  shownProblems: HomebrewProblem[];
  onStep: (step: number) => void;
}

/**
 * A button naming each step and one for the preview past the last, then one step of the
 * kind's form with the problems in fields it has no control for.
 */
export function HomebrewStepMode({
  kind,
  step,
  draft,
  settings,
  shownProblems,
  onStep,
}: HomebrewStepModeProps) {
  const current = kind.steps[step];
  return (
    <>
      <nav aria-label="Steps">
        <ol className="flex flex-wrap items-center gap-1">
          {kind.steps.map(({ title }, index) => (
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
          <li className="flex items-center gap-1 border-border border-l pl-2">
            <button
              type="button"
              onClick={() => onStep(kind.steps.length)}
              className="inline-flex items-center gap-1.5 rounded-control border border-accent px-3 py-1 font-semibold text-accent text-row hover:bg-subtle"
            >
              <Eye aria-hidden size={14} />
              Preview
            </button>
          </li>
        </ol>
      </nav>
      <p aria-live="polite" className="text-label text-muted">
        Step {step + 1} of {kind.steps.length}
      </p>
      {current && (
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
      )}
    </>
  );
}
