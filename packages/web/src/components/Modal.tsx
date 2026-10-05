import { ChevronLeft } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { InModal } from "./inModalContext.ts";

/**
 * The one modal dialog, showing one entry at a time. It opens on `children`, a
 * `ModalEntry`; an entry opened from inside it replaces the one showing, and the back
 * button over the backdrop steps back through them, closing the modal from the first.
 *
 * The native `<dialog>` traps focus and marks the page behind it inert; Escape arrives as
 * `cancel` and a press and click on the backdrop as ones on the dialog itself, and both
 * are routed to `onClose` from any depth so the caller unmounts it and returns focus. The
 * page behind it does not scroll while it is open. It is never printed.
 */
export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  // A selection dragged out of the content ends in a click on the dialog; only a press that
  // also began on the backdrop closes it.
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const [trail, setTrail] = useState<{ entry: ReactNode; backTo: string }[]>([]);
  const context = useMemo(
    () => ({
      titleId,
      open: (entry: ReactNode) => {
        const backTo = document.getElementById(titleId)?.textContent ?? "";
        setTrail((current) => [...current, { entry, backTo }]);
        // The control that opened the entry goes with the entry it sat in.
        close.current?.focus();
      },
    }),
    [titleId],
  );

  // jsdom has no showModal; a second call under StrictMode finds the dialog already open.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // showModal focuses the back button, first in reading order as it is on screen; the
    // dialog opens on Close instead.
    close.current?.focus();
  }, []);

  const previous = trail.at(-1);
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
      className="m-auto max-h-[80%] w-3xl max-w-[calc(100%-2rem)] flex-col rounded-card border-0 bg-surface p-0 text-ink shadow-modal open:flex print:hidden"
    >
      {/* Fixed to the viewport, so it draws over the backdrop rather than inside the dialog's box. */}
      <button
        type="button"
        onClick={() => (previous ? setTrail(trail.slice(0, -1)) : onClose())}
        className="fixed top-4 left-4 flex cursor-pointer items-center gap-1 rounded-control bg-surface py-1.5 pr-3 pl-2 font-semibold text-ink text-row shadow-lg"
      >
        <ChevronLeft size={16} />
        {previous ? `Back to ${previous.backTo}` : "Back"}
      </button>
      <button
        ref={close}
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-5 right-5 cursor-pointer text-lg text-muted leading-none"
      >
        <span aria-hidden="true">×</span>
      </button>
      <InModal.Provider value={context}>
        <Fragment key={trail.length}>{previous ? previous.entry : children}</Fragment>
      </InModal.Provider>
    </dialog>
  );
}
