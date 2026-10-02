import type { ReactNode } from "react";

export function LabeledValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted text-row">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
