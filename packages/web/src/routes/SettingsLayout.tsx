import { FlaskConical, Layers, Monitor } from "lucide-react";
import { Outlet } from "react-router";
import { Sidebar, type SidebarProps } from "./Sidebar/Sidebar.tsx";
import { SidebarFrame } from "./SidebarFrame.tsx";

const SECTIONS: SidebarProps["items"] = [
  {
    to: "/settings",
    label: "Display",
    end: true,
    icon: Monitor,
  },
  { to: "/settings/homebrew", label: "Homebrew", icon: FlaskConical },
  { to: "/settings/sources", label: "Sources", icon: Layers },
];

/** The Settings page: the section rail beside the open section, with no character header. */
export function SettingsLayout() {
  return (
    <SidebarFrame rail={<Sidebar label="Settings sections" items={SECTIONS} />}>
      <div className="min-w-0 flex-1 px-gutter py-6">
        <Outlet />
      </div>
    </SidebarFrame>
  );
}
