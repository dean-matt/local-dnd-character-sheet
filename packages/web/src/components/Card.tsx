import { type ReactNode, useId } from "react";

/** A titled panel on the sheet, labeled by its own heading. `aside` sits beside the title; `action` is pushed to the far end. */
export function Card({
  title,
  aside,
  action,
  children,
}: {
  title: string;
  aside?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-2.5">
      <div className="flex items-center gap-1.5 text-label">
        <h3 id={id} className="font-semibold text-muted uppercase tracking-label">
          {title}
        </h3>
        {/* One line tall, so an aside's larger hit target overflows the row rather than growing the card. */}
        {aside && <span className="flex h-lh items-center">{aside}</span>}
        {action && <span className="ml-auto flex h-lh items-center">{action}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
