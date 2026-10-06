import { Navigate, useNavigate, useParams } from "react-router";
import { useCreateCharacter } from "../../hooks/useCreateCharacter.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { CreationErrors } from "./CreationErrors.tsx";
import { CreationRail } from "./CreationRail.tsx";
import { creationForm } from "./creationForm.ts";
import { CREATION_STEPS } from "./creationSteps.ts";
import { IdentityGrants } from "./IdentityGrants.tsx";
import { IdentityStep } from "./IdentityStep.tsx";
import { StepDepartures } from "./StepDepartures.tsx";
import { StepPending } from "./StepPending.tsx";

const { FormShell } = creationForm;

const BUTTON = "rounded-control px-4 py-2 font-semibold text-body";

/**
 * The `characters/new/:step` route: the step rail, the open step, and Back, Next and
 * Finish. Nothing is written until Finish, which validates the whole definition and
 * creates the character; the draft carries the values between steps and across a reload,
 * and Cancel discards it. Next never validates, because guidance refuses no value — a
 * fault surfaces at Finish, with a link to the step that holds it.
 */
export function CreationFlow() {
  const { step: slug } = useParams();
  const navigate = useNavigate();
  const create = useCreateCharacter();
  const step = CREATION_STEPS.find((candidate) => candidate.slug === slug);
  if (step === undefined) {
    return <Navigate to={`/characters/new/${CREATION_STEPS[0].slug}`} replace />;
  }

  const index = CREATION_STEPS.indexOf(step);
  const previous = CREATION_STEPS[index - 1];
  const next = CREATION_STEPS[index + 1];
  const goTo = (slug: string) => navigate(`/characters/new/${slug}`);

  return (
    <FormShell
      onSubmit={async (definition) => {
        const record = await create.mutateAsync(definition);
        navigate(`/characters/${record.id}`);
      }}
      onCancel={() => navigate("/characters")}
    >
      {({ cancel }) => (
        <SidebarFrame rail={<CreationRail current={step} onCancel={cancel} />}>
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-gutter py-6">
            <div>
              <p className="text-muted text-row">
                Step {index + 1} of {CREATION_STEPS.length}
              </p>
              <h1 className="font-bold text-[22px]">{step.label}</h1>
            </div>
            <CreationErrors />
            <IdentityGrants />
            {step.slug === "identity" ? <IdentityStep /> : <StepPending />}
            <StepDepartures step={step} />
            <div className="flex justify-between border-t border-border pt-3">
              <button
                type="button"
                disabled={previous === undefined}
                onClick={() => previous && goTo(previous.slug)}
                className={`${BUTTON} border border-border bg-surface text-ink disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Back
              </button>
              {next ? (
                <button
                  type="button"
                  onClick={() => goTo(next.slug)}
                  className={`${BUTTON} bg-accent text-white hover:bg-accent-hover`}
                >
                  Next: {next.label} →
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {create.isError && (
                    <p role="alert" className="text-body text-error">
                      {create.error.message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={create.isPending}
                    className={`${BUTTON} bg-accent text-white hover:bg-accent-hover disabled:opacity-60`}
                  >
                    Finish →
                  </button>
                </div>
              )}
            </div>
          </div>
        </SidebarFrame>
      )}
    </FormShell>
  );
}
