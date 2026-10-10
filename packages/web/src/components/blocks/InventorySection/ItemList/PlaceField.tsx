import { Select } from "../../../Select.tsx";

const OUTSIDE = "";

/**
 * Where the item is kept: in none of the character's containers, or in one. `holders`
 * are the containers on offer, by their inventory index.
 */
export function PlaceField({
  name,
  holders,
  current,
  onChange,
}: {
  name: string;
  holders: readonly { index: number; name: string }[];
  current: number | null;
  onChange: (holder: number | null) => void;
}) {
  return (
    <Select
      aria-label={`Kept in, ${name}`}
      value={current === null ? OUTSIDE : String(current)}
      options={[
        { value: OUTSIDE, label: "Not in a container" },
        ...holders.map((holder) => ({ value: String(holder.index), label: `In ${holder.name}` })),
      ]}
      onChange={(next) => onChange(next === OUTSIDE ? null : Number(next))}
    />
  );
}
