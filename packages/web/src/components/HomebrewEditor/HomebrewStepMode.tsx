import { Eye } from "lucide-react";
import { HomebrewProblemAlert } from "./HomebrewProblemAlert.tsx";
import { errorFor, type HomebrewProblem } from "./homebrewDraft.ts";
import { type EditingKind, stepOf, stepsOf } from "./homebrewKinds.ts";
import type { useHomebrewEntryDraft } from "./useHomebrewEntryDraft.ts";

export interface HomebrewStepModeProps {
  kind: EditingKind;
  step: number;
  draft: ReturnType<typeof useHomebrewEntryDraft>;
  /** The id of the row being edited, absent for a new one. */
  recordId?: string;
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
  recordId,
  shownProblems,
  onStep,
}: HomebrewStepModeProps) {
  const steps = stepsOf(kind);
  const current = steps[step];
  const shown = kind.shownKeys(draft.entry);
  return (
    <>
      <nav aria-label="Steps" className="shrink-0">
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto @3xl:overflow-hidden">
          <div
            className={`grid gap-6 @3xl:min-h-0 @3xl:flex-1 @3xl:grid-rows-[minmax(0,1fr)] ${current.sections.length > 1 ? "@3xl:grid-cols-2" : ""}`}
          >
            {current.sections.map(({ title, Fields }) => (
              <section
                key={title}
                aria-label={title}
                className="flex min-h-0 min-w-0 flex-col gap-3"
              >
                <h3 className="shrink-0 font-semibold text-sm">{title}</h3>
                {/* Padded and pulled back out, so the scroll container does not clip a focus ring. */}
                <div className="@container -m-1 min-h-0 flex-1 overflow-y-auto p-1">
                  <Fields
                    key={draft.revision}
                    entry={draft.entry}
                    edition={draft.edition}
                    recordId={recordId}
                    onChange={draft.edit}
                    errorFor={(key) => errorFor(shownProblems, key)}
                  />
                </div>
              </section>
            ))}
          </div>
          <HomebrewProblemAlert
            problems={shownProblems.filter(
              ({ key }) => stepOf(kind, key) === step && !shown.includes(key),
            )}
          />
        </div>
      )}
    </>
  );
}
