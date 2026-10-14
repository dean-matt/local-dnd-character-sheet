import type { ReactNode } from "react";
import { PILL } from "../../../../lib/chipStyles.ts";
import { DetailTrigger } from "../../../DetailTrigger.tsx";
import { EmptyNote } from "../../../EmptyNote.tsx";
import { RemovableChipList, type RemovableChipListProps } from "../../../RemovableChipList.tsx";

export interface DefenseChipRowProps {
  heading: string;
  items: readonly { label: string; title: string; effect: string; from: string[] }[];
  /** What the player added by hand, after what is granted, each with × to remove it. */
  added?: RemovableChipListProps["items"];
  onRemove?: RemovableChipListProps["onRemove"];
  /** Shown after the chips, and in place of "None." where there are none. */
  note?: string;
  /** The controls that add to the row, under everything else. */
  children?: ReactNode;
}

const sources = new Intl.ListFormat("en", { type: "conjunction" });

export function DefenseChipRow({
  heading,
  items,
  added = [],
  onRemove = () => {},
  note,
  children,
}: DefenseChipRowProps) {
  const none = items.length === 0 && added.length === 0;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
        {heading}
      </h4>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((chip) => (
            // `effect` names both the kind and the type, so no two chips share it.
            <li key={chip.effect}>
              <DetailTrigger
                title={chip.title}
                meta={`From ${sources.format(chip.from)}`}
                detail={<p>{chip.effect}</p>}
                className={`${PILL} block`}
              >
                <span aria-hidden="true">{chip.label}</span>
                <span className="sr-only">{chip.title}</span>
              </DetailTrigger>
            </li>
          ))}
        </ul>
      )}
      <RemovableChipList items={added} onRemove={onRemove} />
      {note ? <EmptyNote>{note}</EmptyNote> : none && <EmptyNote>None.</EmptyNote>}
      {children && <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}
