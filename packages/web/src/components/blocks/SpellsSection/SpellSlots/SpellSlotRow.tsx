import { type Derived, derivedValue } from "@dnd/character";
import type { z } from "zod";
import { DerivedValue } from "../../DerivedValue.tsx";

/** "slot 3" or "slots 2 to 3". */
function slots(from: number, to: number) {
  return from === to ? `slot ${to}` : `slots ${from} to ${to}`;
}

/**
 * What a click on pip `pip` does: it leaves `pip` expended, so an empty pip spends every
 * slot up to it and an earlier expended pip restores those after it; the last expended pip
 * restores itself.
 */
function pipAction(pip: number, expended: number, label: string) {
  if (pip > expended) return { to: pip, name: `Expend ${label} ${slots(expended + 1, pip)}` };
  if (pip === expended) return { to: pip - 1, name: `Restore ${label} ${slots(pip, pip)}` };
  return { to: pip, name: `Restore ${label} ${slots(pip + 1, expended)}` };
}

/**
 * A slot level's pips, filled while expended, each a button that sets the expended count.
 * The count beside them opens the override. Each button is 24px for its target size; the pip
 * it draws keeps the mockup's 15px.
 */
export function SpellSlotRow({
  label,
  spoken = label,
  total,
  expended,
  writing,
  onExpend,
  overrideKey,
  schema,
}: {
  label: string;
  spoken?: string;
  total: Derived<number>;
  expended: number;
  writing: boolean;
  onExpend: (expended: number) => void;
  overrideKey: string;
  schema: z.ZodType<number>;
}) {
  const count = derivedValue(total);
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="w-12 shrink-0 text-xs">
        {label}
      </span>
      <span className="flex grow flex-wrap">
        {Array.from({ length: count }, (_, index) => {
          const action = pipAction(index + 1, expended, spoken);
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: pips are interchangeable.
              key={index}
              type="button"
              aria-label={action.name}
              aria-disabled={writing}
              onClick={() => !writing && onExpend(action.to)}
              className="grid size-6 shrink-0 place-items-center aria-disabled:cursor-not-allowed"
            >
              <span
                className={`size-[15px] rounded-full border-[1.5px] border-accent ${index < expended ? "bg-accent forced-colors:bg-[Highlight]" : ""}`}
              />
            </button>
          );
        })}
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
