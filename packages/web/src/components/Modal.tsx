import { type ReactNode, useEffect, useId, useRef } from "react";

/**
 * A modal dialog for one entry's detail. The native `<dialog>` traps focus and marks the
 * page behind it inert; Escape arrives as `cancel` and is routed to `onClose` so the
 * caller unmounts it and returns focus. It is never printed.
 */
export function Modal({
  title,
  meta,
  onClose,
  children,
}: {
  title: string;
  meta?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // jsdom has no showModal, and a second call under StrictMode throws.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[80%] w-80 max-w-[85%] overflow-auto rounded-card border-0 bg-surface p-5 text-ink shadow-modal print:hidden"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={titleId} className="font-bold text-title">
          {title}
        </h2>
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
    </dialog>
  );
}
