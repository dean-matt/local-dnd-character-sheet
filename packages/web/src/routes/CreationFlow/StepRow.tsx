import { Check } from "lucide-react";
import { Link } from "react-router";
import { type CreationStep, stepLink } from "./creationSteps.ts";

/** One step in the creation rail: its number, or a check once done, and its label. */
export function StepRow({
  step,
  number,
  isCurrent,
  isDone,
  collapsed,
}: {
  step: CreationStep;
  number: number;
  isCurrent: boolean;
  isDone: boolean;
  collapsed: boolean;
}) {
  return (
    <li>
      <Link
        {...stepLink(step.slug)}
        aria-current={isCurrent ? "step" : undefined}
        className={`flex items-center gap-3 rounded-control py-2 text-sm ${
          collapsed ? "justify-center" : "px-2.5"
        } ${
          isCurrent
            ? "bg-accent-tint font-semibold text-ink"
            : "font-medium text-secondary hover:bg-subtle"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border font-bold text-label ${
            isCurrent
              ? "border-accent bg-accent text-white"
              : isDone
                ? "border-accent bg-accent-tint text-accent-text"
                : "border-border bg-surface text-muted"
          }`}
        >
          {isDone && !isCurrent ? <Check size={12} /> : number}
        </span>
        <span className={collapsed ? "sr-only" : undefined}>{step.label}</span>
        {isDone && <span className="sr-only">, done</span>}
      </Link>
    </li>
  );
}
