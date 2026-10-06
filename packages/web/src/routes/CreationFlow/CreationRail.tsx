import { Rail } from "../Rail.tsx";
import { CREATION_STEPS, type CreationStep } from "./creationSteps.ts";
import { StepRow } from "./StepRow.tsx";
import { useAbilitiesDone } from "./useAbilitiesDone.ts";
import { useClassDone } from "./useClassDone.ts";
import { useIdentityDone } from "./useIdentityDone.ts";

/**
 * The flow's step list, the current step marked. Every step is a link, because the flow
 * refuses nothing — a later step is open before the earlier ones are finished. A step reads
 * as done only while its own choices are complete, never for having been passed. Collapsed,
 * it shows the step numbers alone, each label kept for a screen reader.
 */
export function CreationRail({ current }: { current: CreationStep }) {
  const currentIndex = CREATION_STEPS.indexOf(current);
  const identityDone = useIdentityDone();
  const classDone = useClassDone();
  const abilitiesDone = useAbilitiesDone();
  const done = new Set<CreationStep["slug"]>([
    ...(identityDone ? ["identity" as const] : []),
    ...(classDone ? ["class" as const] : []),
    ...(abilitiesDone ? ["abilities" as const] : []),
  ]);
  return (
    <Rail>
      {(collapsed) => (
        <div className="flex flex-col gap-1.5">
          {!collapsed && (
            <p className="px-2.5 pb-1.5 font-semibold text-label text-muted uppercase tracking-label">
              New Character
            </p>
          )}
          <nav aria-label="Creation steps">
            <ol className="flex flex-col gap-0.5">
              {CREATION_STEPS.map((step, index) => (
                <StepRow
                  key={step.slug}
                  step={step}
                  number={index + 1}
                  isCurrent={index === currentIndex}
                  isDone={done.has(step.slug)}
                  collapsed={collapsed}
                />
              ))}
            </ol>
          </nav>
        </div>
      )}
    </Rail>
  );
}
