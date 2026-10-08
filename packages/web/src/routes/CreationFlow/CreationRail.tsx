import { Rail } from "../Rail.tsx";
import type { CreationStep } from "./creationSteps.ts";
import type { EquipmentMemory } from "./equipmentPicks.ts";
import { StepRow } from "./StepRow.tsx";
import { useAbilitiesDone } from "./useAbilitiesDone.ts";
import { useClassDone } from "./useClassDone.ts";
import { useIdentityDone } from "./useIdentityDone.ts";
import { useProficienciesDone } from "./useProficienciesDone.ts";
import { useSpellsDone } from "./useSpellsDone.ts";

/**
 * The flow's step list, the current step marked. Every step is a link, because the flow
 * refuses nothing — a later step is open before the earlier ones are finished. A step reads
 * as done only while its own choices are complete, never for having been passed. Collapsed,
 * it shows the step numbers alone, each label kept for a screen reader.
 */
export function CreationRail({
  steps,
  current,
  equipment,
}: {
  /** The steps this draft walks, which leave out Spells for a class that casts nothing. */
  steps: readonly CreationStep[];
  current: CreationStep;
  /** The starting-equipment picks the flow holds, which the step's done mark reads. */
  equipment: EquipmentMemory;
}) {
  const currentIndex = steps.indexOf(current);
  const identityDone = useIdentityDone();
  const classDone = useClassDone();
  const abilitiesDone = useAbilitiesDone();
  const proficienciesDone = useProficienciesDone(equipment);
  const spellsDone = useSpellsDone();
  const done = new Set<CreationStep["slug"]>([
    ...(identityDone ? ["identity" as const] : []),
    ...(classDone ? ["class" as const] : []),
    ...(abilitiesDone ? ["abilities" as const] : []),
    ...(proficienciesDone ? ["equipment" as const] : []),
    ...(spellsDone ? ["spells" as const] : []),
  ]);
  return (
    <Rail>
      {(collapsed) => (
        <nav aria-label="Creation steps">
          <ol className="flex flex-col gap-0.5">
            {steps.map((step, index) => (
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
      )}
    </Rail>
  );
}
