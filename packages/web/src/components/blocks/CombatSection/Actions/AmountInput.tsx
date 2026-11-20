import type { FeatureResource } from "../../../../lib/featureResource.ts";

/** How much of a pool a use spends, where its cost varies between the resource's least and most. */
export function AmountInput({
  name,
  resource,
  amount,
  onChange,
}: {
  name: string;
  resource: FeatureResource | null;
  amount: number;
  onChange: (amount: number) => void;
}) {
  if (!resource || resource.max <= resource.min) return null;
  return (
    <input
      type="number"
      aria-label={`Amount to spend on ${name}`}
      min={resource.min}
      max={resource.max}
      value={amount}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className="h-6 w-12 rounded-control border border-border bg-surface px-1 text-row"
    />
  );
}
