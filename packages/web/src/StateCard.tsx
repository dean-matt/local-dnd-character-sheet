import type { ReactNode } from "react";

export function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 text-muted text-row">
      {children}
    </div>
  );
}
