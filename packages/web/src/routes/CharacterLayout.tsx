import { NavLink, Outlet, useParams } from "react-router";
import { getCharacterPages, visiblePages } from "../pages.ts";

export function CharacterLayout() {
  const { id = "" } = useParams();
  const pages = visiblePages(getCharacterPages(id));

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <nav
        aria-label="Character pages"
        className="flex flex-row flex-wrap gap-2 sm:w-40 sm:shrink-0 sm:flex-col"
      >
        {pages.map((page) => (
          <NavLink
            key={page.slug}
            to={`/characters/${id}/p/${page.slug}`}
            className={({ isActive }) =>
              `rounded-full border border-border px-3 py-1 text-row ${
                isActive ? "bg-accent text-white" : ""
              }`
            }
          >
            {page.title}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
