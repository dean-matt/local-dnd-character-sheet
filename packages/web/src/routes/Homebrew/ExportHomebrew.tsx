import { Download } from "lucide-react";
import { useContext } from "react";
import { ExportSelection } from "./exportSelectionContext.ts";

/**
 * Export for the entries chosen across the page's tabs, with their count, and Clear while any
 * are chosen. Its status and alert lines take a row of their own below the row it sits in.
 */
export function ExportHomebrew() {
  const selection = useContext(ExportSelection);
  if (!selection) return null;
  const { count, exporting } = selection;
  const blocked = count === 0 || exporting;

  return (
    <>
      <button
        type="button"
        aria-disabled={blocked || undefined}
        onClick={() => !blocked && selection.exportChosen()}
        className="flex items-center gap-1 rounded-control border border-border bg-surface px-3 py-1.5 font-semibold text-ink text-row hover:bg-subtle aria-disabled:opacity-50 aria-disabled:hover:bg-surface"
      >
        <Download aria-hidden="true" size={12} strokeWidth={2.5} />
        {exporting ? "Exporting…" : count > 0 ? `Export (${count})` : "Export"}
      </button>
      {count > 0 && (
        <button
          type="button"
          onClick={selection.clear}
          className="flex items-center gap-1 rounded-control border border-accent px-3 py-1.5 font-semibold text-accent-text text-row hover:bg-subtle"
        >
          Clear
        </button>
      )}
      <p role="status" className="order-last basis-full text-row empty:hidden">
        {selection.done}
      </p>
      <p role="alert" className="order-last basis-full text-error text-row empty:hidden">
        {selection.failure && `Export failed: ${selection.failure}`}
      </p>
    </>
  );
}
