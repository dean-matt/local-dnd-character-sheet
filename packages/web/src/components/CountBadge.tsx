export type CountBadgeProps = {
  count: number;
  /** Positions the badge on the corner of its `relative` parent. */
  className: string;
};

/** A count overlaid on a control's corner, hidden from assistive tech, drawn only above zero. */
export function CountBadge({ count, className }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={`absolute min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-white ${className}`}
    >
      {count}
    </span>
  );
}
