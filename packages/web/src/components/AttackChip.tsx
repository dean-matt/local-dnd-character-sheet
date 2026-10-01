import type { ReactNode } from "react";
import { CHIP } from "../lib/chipStyles.ts";

export function AttackChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span
      className={`${CHIP} flex items-baseline gap-0.75 border-accent bg-surface text-accent-text`}
    >
      <span className="font-normal text-muted">{label}</span>
      {children}
    </span>
  );
}
