import type { ReactNode } from "react";
import { DetailTrigger } from "./DetailTrigger.tsx";

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
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-control bg-subtle px-3 py-2.5 text-sm print:break-inside-avoid print:bg-transparent print:px-0">
      {detail ? (
        <DetailTrigger
          title={name}
          meta={detail.meta}
          detail={detail.children}
          className="min-w-0 truncate font-semibold print:overflow-visible print:whitespace-normal"
        >
          {name}
        </DetailTrigger>
      ) : (
        <span
          title={name}
          className="min-w-0 truncate font-semibold print:overflow-visible print:whitespace-normal"
        >
          {name}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
        {chips}
        {value && <span className="ml-auto shrink-0 text-label text-muted">{value}</span>}
      </div>
      {preview && <div className="truncate text-label text-muted print:hidden">{preview}</div>}
    </li>
  );
}
