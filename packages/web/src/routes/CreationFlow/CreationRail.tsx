import { X } from "lucide-react";
import { Link } from "react-router";
import { CREATION_STEPS, type CreationStep } from "./creationSteps.ts";

/**
 * The flow's step list, the current step marked. Every step is a link, because the flow
 * refuses nothing — a later step is open before the earlier ones are finished — and no
 * step reads as done, since reaching a step past it says nothing about what it holds.
 */
export function CreationRail({
  current,
  onCancel,
}: {
  current: CreationStep;
  onCancel: () => void;
}) {
  const currentIndex = CREATION_STEPS.indexOf(current);
  return (
    <div className="flex h-full w-sidebar flex-col gap-1.5 overflow-y-auto border-r border-border bg-surface px-4 py-5">
      <p className="px-2.5 pb-1.5 font-semibold text-label text-muted uppercase tracking-label">
        New Character
      </p>
      <nav aria-label="Creation steps">
        <ol className="flex flex-col gap-0.5">
          {CREATION_STEPS.map((step, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li key={step.slug}>
                <Link
                  to={`/characters/new/${step.slug}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-3 rounded-control px-2.5 py-2 text-sm ${
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
                        : "border-border bg-surface text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span>{step.label}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex-1" />
      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 font-medium text-body text-secondary hover:bg-subtle"
        >
          <X aria-hidden="true" size={16} className="shrink-0 text-muted" />
          Cancel
        </button>
      </div>
    </div>
  );
}
