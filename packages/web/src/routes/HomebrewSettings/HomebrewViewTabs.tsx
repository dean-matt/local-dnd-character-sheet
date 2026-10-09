import { type KeyboardEvent, useRef } from "react";

type View = "Edit" | "Preview";

export interface HomebrewViewTabsProps {
  label: string;
  idPrefix: string;
  view: View;
  onView: (view: View) => void;
}

/**
 * The Edit / Preview tabs a narrow editor shows, `${idPrefix}-<view>` naming each panel.
 * The arrow keys move between the two, and Home and End go to the first and the last.
 */
export function HomebrewViewTabs({ label, idPrefix, view, onView }: HomebrewViewTabsProps) {
  const tabs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const onKey = (event: KeyboardEvent) => {
    const other = view === "Edit" ? "Preview" : "Edit";
    const keys: Record<string, View> = {
      ArrowLeft: other,
      ArrowRight: other,
      Home: "Edit",
      End: "Preview",
    };
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    onView(next);
    tabs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 @3xl:hidden">
      {(["Edit", "Preview"] as const).map((each) => (
        <button
          key={each}
          ref={(button) => {
            tabs.current[each] = button;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-${each}-tab`}
          aria-controls={`${idPrefix}-${each}`}
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
