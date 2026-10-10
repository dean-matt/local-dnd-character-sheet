import { Coins } from "lucide-react";
import type { ReactNode } from "react";
import { CHIP } from "../../lib/chipStyles.ts";
import { DetailTrigger } from "../DetailTrigger.tsx";
import { SourceChip } from "../SourceChip.tsx";

/**
 * The one row every list on the sheet draws, in up to three lines: the name beside its
 * source chip, property chips and a price chip; a one-line preview of the rules text; then the row's
 * action chips, with its controls at the right. A row with neither actions nor controls
 * has no third line. A row with `detail` opens it in a modal from its name; one without is
 * plain text, since there is nothing to open. `source` is absent on a homebrew row.
 * `priceNote` says where an estimated price comes from. `remove` sits at the end of the
 * first line, such as the button taking the row off a list.
 */
export function ListRow({
  name,
  source,
  chips,
  price,
  priceNote,
  preview,
  actions,
  controls,
  remove,
  detail,
}: {
  name: string;
  source: string | undefined;
  chips?: ReactNode;
  price?: string;
  priceNote?: string;
  preview?: string;
  actions?: ReactNode;
  controls?: ReactNode;
  remove?: ReactNode;
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
        <SourceChip source={source} />
        {chips}
        {price && (
          <span
            title={priceNote}
            className={`${CHIP} flex shrink-0 items-center gap-0.75 border-money-border bg-money-tint text-money leading-3`}
          >
            <Coins size={9} strokeWidth={2.5} />
            <span className="sr-only">{priceNote ? "Estimated cost " : "Cost "}</span>
            {price}
          </span>
        )}
        {remove && <span className="ml-auto flex shrink-0 print:hidden">{remove}</span>}
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
