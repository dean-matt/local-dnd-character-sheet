import type { SourceShelf } from "../../lib/sourceShelves.ts";

type Group = SourceShelf["label"];

const chip =
  "rounded-pill border border-border px-3 py-1 font-semibold text-label text-muted hover:bg-subtle aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white aria-pressed:hover:bg-accent-hover forced-colors:aria-pressed:bg-[Highlight] forced-colors:aria-pressed:text-[HighlightText]";

/**
 * Toggle chips narrowing the list to the chosen groups, any number at once. All is
 * pressed while none is chosen, and pressing it clears the choice.
 */
export function SourceGroupChips({
  groups,
  chosen,
  onChange,
}: {
  groups: readonly Group[];
  chosen: readonly Group[];
  onChange: (chosen: Group[]) => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form fields; this groups toggle buttons.
    <div role="group" aria-label="Show groups" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={chosen.length === 0}
        onClick={() => onChange([])}
        className={chip}
      >
        All
      </button>
      {groups.map((group) => (
        <button
          key={group}
          type="button"
          aria-pressed={chosen.includes(group)}
          onClick={() =>
            onChange(
              chosen.includes(group) ? chosen.filter((g) => g !== group) : [...chosen, group],
            )
          }
          className={chip}
        >
          {group}
        </button>
      ))}
    </div>
  );
}
