import { type ReactNode, useEffect, useRef, useState } from "react";
import { Modal } from "./Modal.tsx";

/**
 * A button that opens one entry's detail in a modal and takes focus back when it closes.
 * The modal mounts only while open, so its content fetches nothing until asked.
 */
export function DetailTrigger({
  title,
  meta,
  detail,
  className,
  children,
}: {
  title: string;
  meta?: ReactNode;
  detail: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // After the dialog unmounts, so the focus lands on an element that is no longer inert.
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`cursor-pointer text-left ${className ?? ""}`}
      >
        {children}
      </button>
      {open && (
        <Modal title={title} meta={meta} onClose={() => setOpen(false)}>
          {detail}
        </Modal>
      )}
    </>
  );
}
