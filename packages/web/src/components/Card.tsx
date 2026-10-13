import { type ReactNode, useId } from "react";

/** A titled panel on the sheet, labeled by its own heading. `aside` sits beside the title. */
export function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-2.5">
      <div className="flex items-center gap-1.5">
        <h3 id={id} className="font-semibold text-label text-muted uppercase tracking-label">
          {title}
        </h3>
        {aside}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
