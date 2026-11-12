import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { isLevelTerm } from "../../../../lib/levelTerm.ts";
import { TermList } from "../../../TermList.tsx";

type Term = { label: string; value: number };

/**
 * The hit point maximum's terms, with two or more levels' terms folded into one line that
 * names the level range and their total, behind a button that lists them in place. It opens
 * folded each time it mounts.
 */
export function HitPointTermList({ terms }: { terms: readonly Term[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const levels = terms.filter(isLevelTerm);
  if (levels.length < 2) return <TermList terms={terms} />;
  const others = terms.filter((term) => !isLevelTerm(term));
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="flex justify-between gap-4 text-left"
      >
        <span className="flex items-center gap-1">
          <Chevron size={12} aria-hidden="true" />
          Levels 1–{levels.length}
        </span>
        <span>{levels.reduce((sum, term) => sum + term.value, 0)}</span>
      </button>
      <div id={listId} hidden={!open} className="pl-4 text-muted">
        <TermList terms={levels} />
      </div>
      {others.length > 0 && <TermList terms={others} />}
    </div>
  );
}
