import { createContext } from "react";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";

export interface ChosenEntry {
  collection: HomebrewCollection;
  id: string;
}

/**
 * The entries chosen for export and the export of them, held by the Homebrew page so a choice
 * survives a change of tab. `done` says what the last export wrote. `null` where a list renders
 * outside that page, which offers no export.
 */
export const ExportSelection = createContext<{
  isChosen: (entry: ChosenEntry) => boolean;
  toggle: (entry: ChosenEntry) => void;
  count: number;
  clear: () => void;
  exportChosen: () => void;
  exporting: boolean;
  done: string;
  failure: string | undefined;
} | null>(null);
