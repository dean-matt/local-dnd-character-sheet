import { type KeyboardEvent, useRef } from "react";

export interface HomebrewViewTabsProps<V extends string> {
  label: string;
  /** Names the one panel the tabs control, `${idPrefix}-panel`, and each tab, `${idPrefix}-tab-<index>`. */
  idPrefix: string;
  views: readonly V[];
  view: V;
  onView: (view: V) => void;
}

/**
 * Tabs choosing how the editor shows its entry. The arrow keys move between them, and Home
 * and End go to the first and the last.
 */
export function HomebrewViewTabs<V extends string>({
  label,
  idPrefix,
  views,
  view,
  onView,
}: HomebrewViewTabsProps<V>) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent) => {
    const at = views.indexOf(view);
    const keys: Record<string, number> = {
      ArrowLeft: (at - 1 + views.length) % views.length,
      ArrowRight: (at + 1) % views.length,
      Home: 0,
      End: views.length - 1,
    };
    const index = keys[event.key];
    const next = index === undefined ? undefined : views[index];
    if (index === undefined || next === undefined) return;
    event.preventDefault();
    onView(next);
    tabs.current[index]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1">
      {views.map((each, index) => (
        <button
          key={each}
          ref={(button) => {
            tabs.current[index] = button;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${index}`}
          aria-controls={`${idPrefix}-panel`}
          aria-selected={view === each}
          tabIndex={view === each ? 0 : -1}
          onClick={() => onView(each)}
          onKeyDown={onKey}
          className="rounded-control px-3 py-1.5 font-semibold text-muted text-row hover:bg-subtle aria-selected:bg-subtle aria-selected:text-ink"
        >
          {each}
        </button>
      ))}
    </div>
  );
}
