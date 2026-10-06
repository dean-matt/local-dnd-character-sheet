import { PILL } from "../../../../lib/chipStyles.ts";
import { DetailTrigger } from "../../../DetailTrigger.tsx";
import { EmptyNote } from "../../../EmptyNote.tsx";

export interface DefenseChipRowProps {
  heading: string;
  items: readonly { label: string; title: string; effect: string; from: string[] }[];
  /** Shown after the chips, and in place of "None." where there are none. */
  note?: string;
}

const sources = new Intl.ListFormat("en", { type: "conjunction" });

export function DefenseChipRow({ heading, items, note }: DefenseChipRowProps) {
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
      {note ? <EmptyNote>{note}</EmptyNote> : items.length === 0 && <EmptyNote>None.</EmptyNote>}
    </div>
  );
}
