import type { ReactNode } from "react";
import type { CreationStep } from "./creationSteps.ts";
import { useCreationSteps } from "./useCreationSteps.ts";

export interface CreationStepsProps {
  current: CreationStep;
  children: (steps: readonly CreationStep[]) => ReactNode;
}

/** Hands its children the steps this draft walks, read inside the form they depend on. */
export function CreationSteps({ current, children }: CreationStepsProps) {
  return children(useCreationSteps(current));
}
