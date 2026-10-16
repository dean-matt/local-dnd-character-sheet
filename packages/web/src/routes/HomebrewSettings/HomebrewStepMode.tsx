import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { HomebrewProblemAlert } from "./HomebrewProblemAlert.tsx";
import { errorFor, type HomebrewProblem } from "./homebrewDraft.ts";
import { type HomebrewKind, stepOf, stepsOf } from "./homebrewKinds.ts";
import type { useHomebrewEntryDraft } from "./useHomebrewEntryDraft.ts";

export interface HomebrewStepModeProps {
  kind: HomebrewKind;
  step: number;
  draft: ReturnType<typeof useHomebrewEntryDraft>;
  /** The example a new entry starts from, shown above the steps. */
  starter: ReactNode;
  /** The entry's edition, shown first in the first section. */
  rules: ReactNode;
  /** The problems to name, which stay empty until a step or a save is tried. */
  shownProblems: HomebrewProblem[];
  onStep: (step: number) => void;
}

/**
 * A button naming each step and one for the preview past the last, then one step of the
 * kind's form: its sections side by side where the modal is wide, stacked where it is not,
 * with the problems in fields they have no control for.
 */
export function HomebrewStepMode({
  kind,
  step,
  draft,
  starter,
  rules,
  shownProblems,
  onStep,
}: HomebrewStepModeProps) {
  const steps = stepsOf(kind);
  const current = steps[step];
  return (
    <>
      <nav aria-label="Steps">
        <ol className="flex flex-wrap items-center gap-1">
          {steps.map(({ title }, index) => (
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
              onClick={() => onStep(steps.length)}
              className="inline-flex items-center gap-1.5 rounded-control border border-accent px-3 py-1 font-semibold text-accent text-row hover:bg-subtle"
            >
              <Eye aria-hidden size={14} />
              Preview
            </button>
          </li>
        </ol>
      </nav>
      <p aria-live="polite" className="sr-only">
        Step {step + 1} of {steps.length}
      </p>
      {current && (
        <>
          {step === 0 && starter}
          <div className={`grid gap-6 ${current.sections.length > 1 ? "@3xl:grid-cols-2" : ""}`}>
            {current.sections.map(({ title, Fields }, index) => (
              <section
                key={title}
                aria-label={title}
                className="@container flex min-w-0 flex-col gap-3"
              >
                <h3 className="font-semibold text-sm">{title}</h3>
                {step === 0 && index === 0 && rules}
                <Fields
                  key={draft.revision}
                  entry={draft.entry}
                  edition={draft.edition}
                  onChange={draft.edit}
                  errorFor={(key) => errorFor(shownProblems, key)}
                />
              </section>
            ))}
          </div>
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
