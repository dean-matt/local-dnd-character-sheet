import { type ReactNode, useId } from "react";

/** A titled panel on the sheet, labeled by its own heading. */
export function Card({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-3.5">
      <h3 id={id} className="font-semibold text-label text-muted uppercase tracking-label">
        {title}
      </h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
