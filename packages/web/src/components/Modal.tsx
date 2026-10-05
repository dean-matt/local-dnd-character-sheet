import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { InModal } from "./inModalContext.ts";

/**
 * A modal dialog for one entry's detail. The native `<dialog>` traps focus and marks the
 * page behind it inert; Escape arrives as `cancel` and a press and click on the backdrop as
 * ones on the dialog itself, and both are routed to `onClose` so the caller unmounts it and
 * returns focus. Only the body scrolls: the header and the optional `footer` stay put, and
 * where they leave the body less room than they take, the dialog widens and grows taller up
 * to the viewport. It is never printed.
 */
export function Modal({
  title,
  badge,
  meta,
  footer,
  width = "w-80",
  onClose,
  children,
}: {
  title: string;
  /** Sits beside the title, outside the heading that names the dialog. */
  badge?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  width?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A selection dragged out of the content ends in a click on the dialog; only a press that
  // also began on the backdrop closes it.
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const header = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const [roomy, setRoomy] = useState(false);

  // Latched: growing gives the body room again, and releasing it would flip the size back.
  useEffect(() => {
    const dialog = ref.current;
    if (roomy || !dialog || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => {
      const scroll = body.current;
      if (!scroll || scroll.scrollHeight <= scroll.clientHeight) return;
      const chrome = (header.current?.offsetHeight ?? 0) + (foot.current?.offsetHeight ?? 0);
      if (scroll.clientHeight < chrome) setRoomy(true);
    });
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [roomy]);

  // jsdom has no showModal; a second call under StrictMode finds the dialog already open.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click lands on the backdrop, which takes no focus; Escape is its keyboard twin, handled as `cancel`.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // React bubbles `cancel` to an enclosing modal; the browser cancels only the top one.
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
      }}
      className={`m-auto ${roomy ? "max-h-[calc(100%-2rem)] w-4xl max-w-[95%]" : `max-h-[80%] ${width} max-w-[85%]`} flex-col rounded-card border-0 bg-surface p-0 text-ink shadow-modal open:flex print:hidden`}
    >
      <InModal.Provider value={true}>
        <div ref={header} className="shrink-0 px-5 pt-5 pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 id={titleId} className="font-bold text-title">
                {title}
              </h2>
              {badge}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="cursor-pointer text-lg text-muted leading-none"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          {meta && <div className="mt-1 text-muted text-row">{meta}</div>}
        </div>
        <section
          ref={body}
          aria-labelledby={titleId}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll container takes focus so the keyboard can scroll it; the dialog opens with focus on the close button, outside it.
          tabIndex={0}
          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-5 text-body leading-normal ${footer ? "pb-3" : "pb-5"}`}
        >
          {children}
        </section>
        {footer && (
          <div
            ref={foot}
            className="flex shrink-0 justify-end border-border border-t px-5 pt-3 pb-5"
          >
            {footer}
          </div>
        )}
      </InModal.Provider>
    </dialog>
  );
}
