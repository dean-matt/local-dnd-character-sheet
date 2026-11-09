import { useState } from "react";
import { useCatalogSearch } from "../../../../hooks/useCatalogSearch.ts";
import { Combobox } from "../../../Combobox.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * Searches the edition's catalog conditions and adds the chosen one. The list leaves out
 * Exhaustion, which has its own stepper, and every name already held. Typed text that is no
 * catalog condition, held condition or Exhaustion offers to add itself as a custom one.
 */
export function AddCondition({
  edition,
  held,
  busy,
  onAdd,
  onAddCustom,
}: {
  edition: "classic" | "one";
  held: ReadonlySet<string>;
  busy: boolean;
  onAdd: (ref: { name: string; source: string }) => void;
  onAddCustom: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const { data } = useCatalogSearch({
    edition,
    type: "condition",
    query: "",
    limit: 100,
    listAll: true,
  });
  const offered = (data?.items ?? []).flatMap((hit) =>
    "source" in hit && hit.name !== "Exhaustion" && !held.has(hit.name)
      ? [{ name: hit.name, source: hit.source }]
      : [],
  );
  const chosen = offered.find((option) => option.name === name);
  const typed = name.trim();
  const known = new Set(
    [...(data?.items ?? []).map((hit) => hit.name), ...held].map((known) => known.toLowerCase()),
  );
  const custom = !chosen && typed !== "" && !known.has(typed.toLowerCase());

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Combobox
          aria-label="Condition to add"
          placeholder="Add a condition…"
          options={offered.map((option) => option.name)}
          value={name}
          onChange={setName}
        />
      </div>
      <button
        type="button"
        aria-label={custom ? `Add custom condition ${typed}` : undefined}
        aria-disabled={(!chosen && !custom) || busy}
        onClick={() => {
          if (busy) return;
          if (chosen) onAdd(chosen);
          else if (custom) onAddCustom(typed);
          else return;
          setName("");
        }}
        className={BUTTON}
      >
        {custom ? "Add custom" : "Add condition"}
      </button>
    </div>
  );
}
