import { createContext, type ReactNode } from "react";

/**
 * Set inside a `Modal`, whose scrolling body clips anything drawn in normal flow. `open`
 * shows an entry in place of the one showing and `back` returns to the one before it; `titleId` names the dialog by its heading.
 */
export const InModal = createContext<{
  titleId: string;
  open: (entry: ReactNode) => void;
  back: () => void;
} | null>(null);
