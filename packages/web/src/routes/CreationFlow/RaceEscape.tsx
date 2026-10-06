import { useState } from "react";
import { InputField } from "../../components/InputField.tsx";

/** The way past the catalog: a race typed by name, for one the picker does not offer. */
export function RaceEscape({ onUse }: { onUse: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit font-semibold text-accent-text text-row"
      >
        Not listed? Type a race
      </button>
    );
  }
  const typed = name.trim();
  return (
    <div className="flex items-end gap-2">
      <InputField
        label="Race name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          // Enter would submit the whole flow; here it uses the typed race.
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (typed) onUse(typed);
        }}
      />
      <button
        type="button"
        disabled={typed === ""}
        onClick={() => onUse(typed)}
        className="mb-px rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body disabled:opacity-60"
      >
        Use
      </button>
    </div>
  );
}
