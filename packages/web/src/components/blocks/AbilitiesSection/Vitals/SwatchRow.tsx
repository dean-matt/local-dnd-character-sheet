import type { ReactNode } from "react";

/** A labeled field, behind a swatch of the ring segment it sets. */
export function SwatchRow({
  label,
  swatch = "transparent",
  children,
}: {
  label: string;
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="size-2 rounded-xs" style={{ background: swatch }} />
      <span aria-hidden="true" className="flex-1">
        {label}
      </span>
      {children}
    </div>
  );
}
