import { Upload } from "lucide-react";
import { useContext, useRef } from "react";
import { ExportSelection } from "./exportSelectionContext.ts";

/**
 * Imports a homebrew file, then says how many entries it created or why it was refused, on a
 * row of its own below the row it sits in.
 */
export function ImportHomebrew() {
  const picker = useRef<HTMLInputElement>(null);
  const selection = useContext(ExportSelection);
  if (!selection) return null;
  const { importing } = selection;

  return (
    <>
      <button
        type="button"
        aria-disabled={importing}
        onClick={() => {
          if (!importing) picker.current?.click();
        }}
        className="flex items-center gap-1 rounded-control border border-border bg-surface px-3 py-1.5 font-semibold text-ink text-row hover:bg-subtle aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        <Upload aria-hidden="true" size={12} strokeWidth={2.5} />
        {importing ? "Importing…" : "Import"}
      </button>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        aria-label="Homebrew file"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) selection.importFile(file);
        }}
      />
      <p role="status" className="order-last basis-full text-row empty:hidden">
        {selection.imported}
      </p>
      {selection.importFailure && (
        <p role="alert" className="order-last basis-full text-error text-row">
          Import failed: {selection.importFailure}
        </p>
      )}
    </>
  );
}
