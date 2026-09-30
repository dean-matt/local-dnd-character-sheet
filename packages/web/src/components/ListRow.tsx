import type { ReactNode } from "react";
import { DetailTrigger } from "./DetailTrigger.tsx";
import { CHIP } from "./Tag.tsx";

/** Lucide's `coins` outline (ISC), the icon the mockup draws on a price chip. */
function CoinsIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

/**
 * The one row every list on the sheet draws, in up to three lines: the name beside its
 * property chips and a price chip; a one-line preview of the rules text; then the row's
 * action chips, with its controls at the right. A row with neither actions nor controls
 * has no third line. A row with `detail` opens it in a modal from its name; one without is
 * plain text, since there is nothing to open.
 */
export function ListRow({
  name,
  chips,
  price,
  preview,
  actions,
  controls,
  detail,
}: {
  name: string;
  chips?: ReactNode;
  price?: string;
  preview?: string;
  actions?: ReactNode;
  controls?: ReactNode;
  detail?: { meta?: ReactNode; children: ReactNode };
}) {
  const nameClass = "min-w-0 truncate font-semibold print:overflow-visible print:whitespace-normal";
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-control bg-subtle px-3 py-2.5 text-sm print:break-inside-avoid print:bg-transparent print:px-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {detail ? (
          <DetailTrigger
            title={name}
            meta={detail.meta}
            detail={detail.children}
            className={nameClass}
          >
            {name}
          </DetailTrigger>
        ) : (
          <span title={name} className={nameClass}>
            {name}
          </span>
        )}
        {chips}
        {price && (
          <span
            className={`${CHIP} flex shrink-0 items-center gap-0.75 border-money-border bg-money-tint text-money leading-3`}
          >
            <CoinsIcon />
            <span className="sr-only">Cost </span>
            {price}
          </span>
        )}
      </div>
      {preview && <div className="truncate text-label text-muted print:hidden">{preview}</div>}
      {(actions || controls) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
          {controls && <div className="ml-auto flex shrink-0 items-center gap-1.5">{controls}</div>}
        </div>
      )}
    </li>
  );
}
