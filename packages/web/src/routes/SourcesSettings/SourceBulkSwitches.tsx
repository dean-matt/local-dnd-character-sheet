import { getDisabledSources, setDisabledSources } from "../../lib/disabledSources.ts";

const bulkBtn =
  "rounded-control border border-border px-2 py-1 text-label text-muted hover:bg-subtle";

function turn(sources: readonly string[], on: boolean) {
  const disabled = new Set(getDisabledSources());
  for (const source of sources) {
    if (on) disabled.delete(source);
    else disabled.add(source);
  }
  setDisabledSources(disabled);
}

/** Turns every source in `sources` on or off at once, leaving every other source as it is. */
export function SourceBulkSwitches({
  sources,
  describedBy,
}: {
  sources: readonly string[];
  /** The ids of the text naming which sources these cover, since both buttons read alike. */
  describedBy: string;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        aria-describedby={describedBy}
        onClick={() => turn(sources, true)}
        className={bulkBtn}
      >
        Turn all on
      </button>
      <button
        type="button"
        aria-describedby={describedBy}
        onClick={() => turn(sources, false)}
        className={bulkBtn}
      >
        Turn all off
      </button>
    </div>
  );
}
