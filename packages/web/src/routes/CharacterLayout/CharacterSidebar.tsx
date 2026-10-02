import type { CharacterPageRecord } from "@dnd/character";
import {
  Book,
  ChartNoAxesColumn,
  ChartNoAxesColumnIncreasing,
  CirclePlus,
  IdCard,
  List,
  type LucideIcon,
  NotebookText,
  Scale,
  ShoppingBag,
  Sparkle,
  Star,
} from "lucide-react";
import { Sidebar } from "../Sidebar/Sidebar.tsx";

const PAGE_ICONS: Record<string, LucideIcon> = {
  stats: ChartNoAxesColumn,
  spells: Sparkle,
  inventory: ShoppingBag,
  features: Star,
  identity: IdCard,
  level: ChartNoAxesColumnIncreasing,
  alignment: Scale,
  backstory: Book,
  notes: NotebookText,
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
        icon: PAGE_ICONS[page.slug] ?? CirclePlus,
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
          <List size={16} />
          {!collapsed && <span>Manage pages</span>}
        </button>
      )}
    />
  );
}
