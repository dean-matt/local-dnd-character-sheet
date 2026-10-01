import type { ReactNode } from "react";
import { StateCard } from "./StateCard.tsx";

export function EmptyState({ children }: { children: ReactNode }) {
  return <StateCard>{children}</StateCard>;
}
