import { type ReactNode, useEffect, useRef, useState } from "react";
import { Modal } from "./Modal.tsx";

/**
 * The one row every list on the sheet draws: the name, the chips beside a right-aligned
 * value, and a one-line preview of the rules text. A row with `detail` opens it in a
 * modal from its name; one without is plain text, since there is nothing to open.
 */
export function ListRow({
  name,
  chips,
  value,
  preview,
  detail,
}: {
  name: string;
  chips?: ReactNode;
  value?: ReactNode;
  preview?: string;
  detail?: { meta?: ReactNode; children: ReactNode };
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
    <li className="flex min-w-0 flex-col gap-1 rounded-control bg-subtle px-3 py-2.5 text-sm print:break-inside-avoid print:bg-transparent print:px-0">
      {detail ? (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="min-w-0 cursor-pointer truncate text-left font-semibold"
        >
          {name}
        </button>
      ) : (
        <span className="min-w-0 truncate font-semibold">{name}</span>
      )}
      {(chips || value) && (
        <div className="flex items-center gap-1.5">
          {chips}
          {value && <span className="ml-auto shrink-0 text-label text-muted">{value}</span>}
        </div>
      )}
      {preview && <div className="truncate text-label text-muted print:hidden">{preview}</div>}
      {open && detail && (
        <Modal title={name} meta={detail.meta} onClose={() => setOpen(false)}>
          {detail.children}
        </Modal>
      )}
    </li>
  );
}
