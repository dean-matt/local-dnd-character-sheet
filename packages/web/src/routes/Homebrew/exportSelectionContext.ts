import { createContext } from "react";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";

export interface ChosenEntry {
  collection: HomebrewCollection;
  id: string;
}

/**
 * The entries chosen for export, the export of them and the import of a file, held by the
 * Homebrew page so each survives a change of tab. `done` says what the last export wrote and
 * `imported` what the last import created. `null` where a list renders outside that page, which
 * offers neither.
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
  importFile: (file: File) => void;
  importing: boolean;
  imported: string;
  importFailure: string | undefined;
} | null>(null);
