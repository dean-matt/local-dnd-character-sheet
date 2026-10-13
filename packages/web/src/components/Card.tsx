import { type ReactNode, type Ref, useId } from "react";

/**
 * A titled panel on the sheet, labeled by its own heading. `aside` sits beside the title.
 * `messagesRef` receives an element at the end of the title row, for a field's `messageSlot`:
 * a save status or error lands on the row the title already holds, so the card keeps its
 * height while a save is in flight.
 */
export function Card({
  title,
  aside,
  messagesRef,
  children,
}: {
  title: string;
  aside?: ReactNode;
  messagesRef?: Ref<HTMLDivElement>;
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
        {messagesRef && (
          // One line, so a message never stands the row taller than the title. A long one is
          // cut short; its live region still holds the whole text.
          <div
            ref={messagesRef}
            className="ms-auto flex min-w-0 items-center *:mt-0 *:not-empty:ms-2 [&_span]:min-w-0 [&_span]:truncate"
          />
        )}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
