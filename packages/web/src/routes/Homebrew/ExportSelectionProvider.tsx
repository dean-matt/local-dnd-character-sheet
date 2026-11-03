import type { HomebrewFile } from "@dnd/catalog";
import { Download } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useExportHomebrew } from "../../hooks/useExportHomebrew.ts";
import { LISTING_KINDS } from "../../lib/homebrewListing.ts";
import { type ChosenEntry, ExportSelection } from "./exportSelectionContext.ts";

const keyOf = ({ collection, id }: ChosenEntry) => `${collection}/${id}`;

/** What the export added that was not chosen: the homebrew parents of chosen subclasses and subraces. */
function addedNote(file: HomebrewFile, chosen: Map<string, ChosenEntry>) {
  const added = file.entries
    .filter((entry) => !chosen.has(keyOf(entry)))
    .map(({ collection, input }) => `${input.name} (${LISTING_KINDS[collection].noun})`);
  return added.length === 0
    ? ""
    : ` Also added ${added.join(", ")}, which ${added.length === 1 ? "a chosen entry needs" : "chosen entries need"} as a parent.`;
}

/**
 * Holds the entries chosen for export across the page's tabs and, once any are chosen, offers
 * to export them as one file. After an export it says what the file holds beyond the choice.
 */
export function ExportSelectionProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState(() => new Map<string, ChosenEntry>());
  const [done, setDone] = useState("");
  const exportFile = useExportHomebrew();

  const selection = {
    isChosen: (row: ChosenEntry) => chosen.has(keyOf(row)),
    toggle: (row: ChosenEntry) => {
      setDone("");
      setChosen((before) => {
        const next = new Map(before);
        if (!next.delete(keyOf(row))) next.set(keyOf(row), row);
        return next;
      });
    },
  };

  const onExport = () =>
    exportFile.mutate([...chosen.values()], {
      onSuccess: (file) => {
        const count = file.entries.length;
        setDone(
          `Exported ${count} ${count === 1 ? "entry" : "entries"} to homebrew.json.${addedNote(file, chosen)}`,
        );
        setChosen(new Map());
      },
    });

  return (
    <ExportSelection.Provider value={selection}>
      {chosen.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-row">
          <span className="font-semibold">{chosen.size} selected</span>
          <button
            type="button"
            aria-disabled={exportFile.isPending}
            onClick={() => !exportFile.isPending && onExport()}
            className="ml-auto flex items-center gap-1 rounded-control border border-accent px-3 py-1 font-semibold text-accent-text hover:bg-subtle aria-disabled:opacity-50"
          >
            <Download aria-hidden="true" size={12} strokeWidth={2.5} />
            {exportFile.isPending ? "Exporting…" : "Export"}
          </button>
          <button
            type="button"
            onClick={() => setChosen(new Map())}
            className="rounded-control px-3 py-1 font-semibold text-muted hover:bg-subtle"
          >
            Clear
          </button>
        </div>
      )}
      <p role="status" className="text-row empty:hidden">
        {done}
      </p>
      <p role="alert" className="text-error text-row empty:hidden">
        {exportFile.error && `Export failed: ${exportFile.error.message}`}
      </p>
      {children}
    </ExportSelection.Provider>
  );
}
