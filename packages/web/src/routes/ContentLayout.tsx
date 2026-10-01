import { Outlet } from "react-router";

/** Adds the default content padding for routes that do not manage their own layout. */
export function ContentLayout() {
  return (
    <div className="px-gutter py-6">
      <Outlet />
    </div>
  );
}
