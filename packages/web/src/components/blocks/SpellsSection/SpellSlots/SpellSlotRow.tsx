import { type Derived, derivedValue } from "@dnd/character";
import type { z } from "zod";
import { DerivedValue } from "../../DerivedValue.tsx";

/** Every pip draws empty: the sheet reads no expended slots yet. The count beside them opens the override. */
export function SpellSlotRow({
  label,
  spoken = label,
  total,
  overrideKey,
  schema,
}: {
  label: string;
  spoken?: string;
  total: Derived<number>;
  overrideKey: string;
  schema: z.ZodType<number>;
}) {
  const count = derivedValue(total);
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="w-12 shrink-0 text-xs">
        {label}
      </span>
      <span aria-hidden="true" className="flex grow flex-wrap gap-[3px]">
        {Array.from({ length: count }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: pips are interchangeable.
            key={index}
            className="size-[15px] shrink-0 rounded-full border-[1.5px] border-accent"
          />
        ))}
      </span>
      <span className="text-muted text-xs">
        <DerivedValue
          name={`${spoken} slots`}
          value={total}
          format={String}
          overrideKey={overrideKey}
          schema={schema}
        />
      </span>
    </li>
  );
}
