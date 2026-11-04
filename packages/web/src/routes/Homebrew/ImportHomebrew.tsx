import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useImportHomebrew } from "../../hooks/useImportHomebrew.ts";

/** Imports a homebrew file, then says how many entries it created or why it was refused. */
export function ImportHomebrew() {
  const picker = useRef<HTMLInputElement>(null);
  const importFile = useImportHomebrew();
  const [done, setDone] = useState("");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-disabled={importFile.isPending}
        onClick={() => {
          if (!importFile.isPending) picker.current?.click();
        }}
        className="flex items-center gap-1 rounded-control border border-border bg-surface px-3 py-1.5 font-semibold text-ink text-row hover:bg-subtle aria-disabled:cursor-wait aria-disabled:opacity-60"
      >
        <Upload aria-hidden="true" size={12} strokeWidth={2.5} />
        {importFile.isPending ? "Importing…" : "Import"}
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
          if (!file) return;
          setDone("");
          importFile.mutate(file, {
            onSuccess: ({ created }) =>
              setDone(
                `Imported ${created} ${created === 1 ? "entry" : "entries"} from ${file.name}.`,
              ),
          });
        }}
      />
      <p role="status" className="text-row empty:hidden">
        {done}
      </p>
      {importFile.isError && (
        <p role="alert" className="max-w-md text-error text-row">
          Import failed: {importFile.error.message}
        </p>
      )}
    </div>
  );
}
