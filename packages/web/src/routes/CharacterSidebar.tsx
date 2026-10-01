import type { CharacterPageRecord } from "@dnd/character";
import { Sidebar } from "./Sidebar.tsx";

const PAGE_PATHS: Record<string, readonly string[]> = {
  stats: ["M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z"],
  spells: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  inventory: ["M6 7h12l1 13a1 1 0 01-1 1H6a1 1 0 01-1-1z", "M9 7a3 3 0 016 0"],
  features: ["M12 2.5l2.9 6.3 6.9.8-5.1 4.8 1.4 6.9L12 17.6l-6.1 3.7 1.4-6.9-5.1-4.8 6.9-.8z"],
  identity: [
    "M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
    "M7 11a2 2 0 104 0 2 2 0 10-4 0",
    "M6 16c0-1.7 1.3-3 3-3s3 1.3 3 3M14 9h5M14 13h5",
  ],
  level: [
    "M5 14h2a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4a1 1 0 011-1z",
    "M11 9h2a1 1 0 011 1v9a1 1 0 01-1 1h-2a1 1 0 01-1-1v-9a1 1 0 011-1z",
    "M17 4h2a1 1 0 011 1v14a1 1 0 01-1 1h-2a1 1 0 01-1-1V5a1 1 0 011-1z",
  ],
  alignment: [
    "M12 3v3M5 21h14M12 6v12",
    "M4 8l3-2 3 2-3 6a3 3 0 01-3-6z",
    "M14 8l3-2 3 2-3 6a3 3 0 01-3-6z",
  ],
  backstory: [
    "M4 5.5A2.5 2.5 0 016.5 3H19v16.5H6.5A2.5 2.5 0 014 22z",
    "M4 19.5A2.5 2.5 0 016.5 17H19",
  ],
  notes: [
    "M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
    "M8 8h8M8 12h8M8 16h5",
  ],
};

/** The character sheet's rail: one row per visible page, and the Manage pages button. */
export function CharacterSidebar({
  characterId,
  pages,
  onManage,
  manageButtonRef,
}: {
  characterId: string;
  pages: CharacterPageRecord[];
  onManage: () => void;
  manageButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Sidebar
      label="Character pages"
      items={pages.map((page) => ({
        to: `/characters/${characterId}/p/${page.slug}`,
        label: page.title,
        icon: PAGE_PATHS[page.slug],
      }))}
      action={(collapsed) => (
        <button
          ref={manageButtonRef}
          type="button"
          aria-label={collapsed ? "Manage pages" : undefined}
          aria-haspopup="dialog"
          onClick={onManage}
          className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M8 6h13M8 12h13M8 18h13" />
            <path d="M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          {!collapsed && <span>Manage pages</span>}
        </button>
      )}
    />
  );
}
