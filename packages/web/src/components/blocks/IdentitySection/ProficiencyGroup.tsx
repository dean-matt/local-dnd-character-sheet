import type { ReactNode } from "react";

export function ProficiencyGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 font-semibold text-label text-muted">{heading}</h4>
      {children}
    </div>
  );
}
