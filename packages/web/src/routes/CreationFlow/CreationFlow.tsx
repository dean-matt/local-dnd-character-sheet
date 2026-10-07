import { X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useCreateCharacter } from "../../hooks/useCreateCharacter.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { AbilityScoresStep } from "./AbilityScoresStep.tsx";
import type { AbilitiesMemory } from "./abilityMethods.ts";
import { ClassStep } from "./ClassStep.tsx";
import { CreationEquipment } from "./CreationEquipment.tsx";
import { CreationErrors } from "./CreationErrors.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { CreationIncreases } from "./CreationIncreases.tsx";
import { CreationRail } from "./CreationRail.tsx";
import { CreationSkills } from "./CreationSkills.tsx";
import { creationForm } from "./creationForm.ts";
import { CREATION_STEPS, type CreationStep, stepIn, stepLink } from "./creationSteps.ts";
import type { EquipmentMemory } from "./equipmentPicks.ts";
import type { HitPointMethod } from "./hitPointGains.ts";
import { IdentityStep } from "./IdentityStep.tsx";
import { ProficienciesStep } from "./ProficienciesStep.tsx";
import { StepDepartures } from "./StepDepartures.tsx";
import { StepPending } from "./StepPending.tsx";

const { FormShell } = creationForm;

const BUTTON = "rounded-control px-4 py-2 font-semibold text-body";

/**
 * The `characters/new` route: the step rail, the open step, and Back, Cancel, Next and Finish.
 * Nothing is written until Finish, which validates the whole definition and creates the
 * character; the draft carries the values between steps and across a reload, and leaving
 * the flow by any route discards it. Next never validates, because guidance refuses no
 * value — a fault surfaces at Finish, with a link to the step that holds it.
 *
 * An entry the flow has not marked with a step is a fresh one, reached by a link or the
 * address bar rather than a reload, so it starts empty over any draft a full-page
 * departure left behind.
 */
export function CreationFlow() {
  const location = useLocation();
  const navigate = useNavigate();
  const create = useCreateCharacter();
  const marked = stepIn(location.state);
  const [fresh] = useState(marked === undefined);
  const [abilities, setAbilities] = useState<AbilitiesMemory>();
  const [hitPoints, setHitPoints] = useState<HitPointMethod>();
  const [equipment, setEquipment] = useState<EquipmentMemory>();
  const step = marked ?? CREATION_STEPS[0];
  const footer = useRef<HTMLDivElement>(null);
  useFooterHeight(footer);

  const goTo = (slug: CreationStep["slug"]) => {
    const { to, ...options } = stepLink(slug);
    navigate(to, options);
  };
  useEffect(() => {
    if (!fresh) return;
    const { to, ...options } = stepLink(CREATION_STEPS[0].slug);
    navigate(to, options);
  }, [fresh, navigate]);

  const body =
    step.slug === "identity" ? (
      <IdentityStep />
    ) : step.slug === "class" ? (
      <ClassStep memory={hitPoints} onMemory={setHitPoints} />
    ) : step.slug === "abilities" ? (
      <AbilityScoresStep memory={abilities} onMemory={setAbilities} />
    ) : step.slug === "equipment" ? (
      <ProficienciesStep memory={equipment} onMemory={setEquipment} />
    ) : (
      <StepPending />
    );

  const index = CREATION_STEPS.indexOf(step);
  const previous = CREATION_STEPS[index - 1];
  const next = CREATION_STEPS[index + 1];

  return (
    <FormShell
      fresh={fresh}
      onSubmit={async (definition) => {
        const record = await create.mutateAsync(definition);
        navigate(`/characters/${record.id}`);
      }}
      onCancel={() => navigate("/characters")}
    >
      {({ cancel }) => (
        <SidebarFrame rail={<CreationRail current={step} equipment={equipment} />}>
          <div className="flex min-w-0 flex-1 flex-col">
            <div data-creation-step className="flex flex-1 flex-col gap-4 px-gutter py-6">
              <div>
                <p className="text-muted text-row">
                  New character · Step {index + 1} of {CREATION_STEPS.length}
                </p>
                <h1 className="font-bold text-[22px]">{step.label}</h1>
              </div>
              <CreationErrors />
              <CreationGrants />
              <CreationIncreases />
              <CreationSkills />
              <CreationEquipment memory={equipment} onMemory={setEquipment} />
              {body}
              <StepDepartures step={step} />
            </div>
            <div
              ref={footer}
              data-creation-footer
              className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-canvas px-gutter py-3 print:hidden"
            >
              <button
                type="button"
                onClick={cancel}
                className={`${BUTTON} flex items-center gap-2 text-secondary hover:bg-subtle`}
              >
                <X aria-hidden="true" size={16} className="shrink-0 text-muted" />
                Cancel
              </button>
              <div className="ml-auto flex items-center gap-2">
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
          </div>
        </SidebarFrame>
      )}
    </FormShell>
  );
}

/**
 * Publishes the footer's height as `--creation-footer-height` on the root, which
 * `scroll-padding-bottom` reads so focus lands above the footer. Measured, not a token,
 * because the footer wraps to a second row in a narrow column.
 */
function useFooterHeight(footer: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = footer.current;
    if (!element) return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() =>
      root.setProperty("--creation-footer-height", `${element.getBoundingClientRect().height}px`),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.removeProperty("--creation-footer-height");
    };
  }, [footer]);
}
