import { PILL } from "../../lib/chipStyles.ts";
import { DetailTrigger } from "../DetailTrigger.tsx";
import { EmptyNote } from "../EmptyNote.tsx";

export interface DefenseChipRowProps {
  heading: string;
  items: readonly { label: string; title: string; effect: string; from: string[] }[];
}

const sources = new Intl.ListFormat("en", { type: "conjunction" });

export function DefenseChipRow({ heading, items }: DefenseChipRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
        {heading}
      </h4>
      {items.length === 0 ? (
        <EmptyNote>None.</EmptyNote>
      ) : (
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
    </div>
  );
}
