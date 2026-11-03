import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Church,
  Dumbbell,
  Shield,
  ShieldPlus,
  Skull,
  Sparkles,
  Swords,
  Trash2,
  UserRound,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { Outlet } from "react-router";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import { LISTING_KINDS } from "../../lib/homebrewListing.ts";
import { Sidebar, type SidebarProps } from "../Sidebar/Sidebar.tsx";
import { SidebarFrame } from "../SidebarFrame.tsx";

const KIND_ICONS: Record<HomebrewCollection, LucideIcon> = {
  items: Swords,
  monsters: Skull,
  spells: Sparkles,
  races: UserRound,
  classes: Shield,
  backgrounds: BookOpen,
  feats: Award,
  skills: Dumbbell,
  subclasses: ShieldPlus,
  subraces: UsersRound,
  deities: Church,
  "optional-features": WandSparkles,
};

const SECTIONS: SidebarProps["items"] = [
  ...Object.values(LISTING_KINDS).map((kind) => ({
    to: `/homebrew/${kind.collection}`,
    label: kind.heading,
    icon: KIND_ICONS[kind.collection],
  })),
];

const FOOTER: SidebarProps["items"] = [
  { to: "/homebrew/deleted", label: "Recently deleted", icon: Trash2 },
];

/** The Homebrew page: a rail of its kinds beside the open one, whose list is the outlet. */
export function HomebrewLayout() {
  return (
    <SidebarFrame rail={<Sidebar label="Homebrew kinds" items={SECTIONS} footerItems={FOOTER} />}>
      <div className="min-w-0 flex-1 px-gutter py-6">
        <section className="flex max-w-6xl flex-col gap-4">
          <h1 className="sr-only">Homebrew</h1>
          <Outlet />
        </section>
      </div>
    </SidebarFrame>
  );
}
