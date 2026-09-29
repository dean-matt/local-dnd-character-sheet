import { Outlet } from "react-router";
import { ThemeToggle } from "../ThemeToggle.tsx";
import { Sidebar, SidebarFrame, type SidebarItem } from "./Sidebar.tsx";

const SECTIONS: SidebarItem[] = [
  {
    to: "/settings",
    label: "Display",
    end: true,
    icon: ["M5 4h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z", "M8 20h8M12 16v4"],
  },
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

export function DisplaySettings() {
  return (
    <section aria-labelledby="display-settings" className="max-w-sm">
      <h1 id="display-settings" className="sr-only">
        Display
      </h1>
      <div className="rounded-card border border-border bg-surface p-4">
        <ThemeToggle />
      </div>
    </section>
  );
}
