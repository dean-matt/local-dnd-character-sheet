import { type ReactNode, useEffect, useId, useRef } from "react";
import { InModal } from "./inModalContext.ts";

/**
 * A modal dialog for one entry's detail. The native `<dialog>` traps focus and marks the
 * page behind it inert; Escape arrives as `cancel` and a press and click on the backdrop as
 * ones on the dialog itself, and both are routed to `onClose` so the caller unmounts it and
 * returns focus. It is never printed.
 */
export function Modal({
  title,
  badge,
  meta,
  width = "w-80",
  onClose,
  children,
}: {
  title: string;
  /** Sits beside the title, outside the heading that names the dialog. */
  badge?: ReactNode;
  meta?: ReactNode;
  width?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A selection dragged out of the content ends in a click on the dialog; only a press that
  // also began on the backdrop closes it.
  const pressedBackdrop = useRef(false);
  const titleId = useId();

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
      className={`m-auto max-h-[80%] ${width} max-w-[85%] flex-col rounded-card border-0 bg-surface p-0 text-ink shadow-modal open:flex print:hidden`}
    >
      <InModal.Provider value={true}>
        <div className="min-h-0 overflow-auto p-5">
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
          {meta && <div className="mt-1 mb-2.5 text-muted text-row">{meta}</div>}
          <div className="flex flex-col gap-2 text-body leading-normal">{children}</div>
        </div>
      </InModal.Provider>
    </dialog>
  );
}
