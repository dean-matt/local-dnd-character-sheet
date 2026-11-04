import type { HomebrewFile } from "@dnd/catalog";
import { type ReactNode, useState } from "react";
import { useExportHomebrew } from "../../hooks/useExportHomebrew.ts";
import { LISTING_KINDS } from "../../lib/homebrewListing.ts";
import { type ChosenEntry, ExportSelection } from "./exportSelectionContext.ts";

const keyOf = ({ collection, id }: ChosenEntry) => `${collection}/${id}`;

/** What the export added that was not chosen: the homebrew parents of chosen subclasses and subraces. */
function addedNote(file: HomebrewFile, sent: Set<string>) {
  const added = file.entries
    .filter((entry) => !sent.has(keyOf(entry)))
    .map(({ collection, input }) => `${input.name} (${LISTING_KINDS[collection].noun})`);
  return added.length === 0
    ? ""
    : ` Also added ${added.join(", ")}, which ${added.length === 1 ? "a chosen entry needs" : "chosen entries need"} as a parent.`;
}

/**
 * Holds the entries chosen for export across the page's tabs and exports them as one file.
 * After an export, `done` says what the file holds beyond the choice.
 */
export function ExportSelectionProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState(() => new Map<string, ChosenEntry>());
  const [done, setDone] = useState("");
  const exportFile = useExportHomebrew();

  // A reset while pending would detach the export's onSuccess, so only a failure is reset.
  const clearError = () => {
    if (exportFile.isError) exportFile.reset();
  };

  const value = {
    isChosen: (row: ChosenEntry) => chosen.has(keyOf(row)),
    toggle: (row: ChosenEntry) => {
      setDone("");
      clearError();
      setChosen((before) => {
        const next = new Map(before);
        if (!next.delete(keyOf(row))) next.set(keyOf(row), row);
        return next;
      });
    },
    count: chosen.size,
    clear: () => {
      clearError();
      setChosen(new Map());
    },
    exportChosen: () => {
      const sent = new Set(chosen.keys());
      exportFile.mutate([...chosen.values()], {
        onSuccess: (file) => {
          const count = file.entries.length;
          setDone(
            `Exported ${count} ${count === 1 ? "entry" : "entries"} to homebrew.json.${addedNote(file, sent)}`,
          );
          // Entries chosen while the request was pending are not in the file, so they stay chosen.
          setChosen((before) => new Map([...before].filter(([key]) => !sent.has(key))));
        },
      });
    },
    exporting: exportFile.isPending,
    done,
    failure: exportFile.error?.message,
  };

  return <ExportSelection.Provider value={value}>{children}</ExportSelection.Provider>;
}
