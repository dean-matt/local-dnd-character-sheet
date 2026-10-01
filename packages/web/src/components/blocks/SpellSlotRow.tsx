import { type Derived, derivedValue } from "@dnd/character";
import { OverrideMark } from "../OverrideMark.tsx";

/** Every pip draws empty: the sheet reads no expended slots yet. */
export function SpellSlotRow({
  label,
  spoken = label,
  total,
}: {
  label: string;
  spoken?: string;
  total: Derived<number>;
}) {
  const count = derivedValue(total);
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="w-12 shrink-0 text-xs">
        {label}
      </span>
      <span className="sr-only">
        {spoken}: {count === 1 ? "1 slot" : `${count} slots`}
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
      {total.manual !== null && <OverrideMark computed={String(total.computed)} />}
    </li>
  );
}
