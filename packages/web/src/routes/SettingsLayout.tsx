import { Outlet } from "react-router";
import { Sidebar, type SidebarProps } from "./Sidebar/Sidebar.tsx";
import { SidebarFrame } from "./SidebarFrame.tsx";

const SECTIONS: SidebarProps["items"] = [
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
