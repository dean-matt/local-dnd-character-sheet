import { useId, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { ManagePages } from "./ManagePages.tsx";

export function CharacterLayout() {
  const { id = "" } = useParams();
  const pages = useCharacterPages(id).data?.filter((page) => !page.hidden) ?? [];
  const [managing, setManaging] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex flex-col gap-2 sm:w-56 sm:shrink-0">
        <nav aria-label="Character pages" className="flex flex-row flex-wrap gap-2 sm:flex-col">
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
        <button
          type="button"
          aria-expanded={managing}
          aria-controls={panelId}
          onClick={() => setManaging((open) => !open)}
          className="self-start text-muted text-row underline"
        >
          Manage pages
        </button>
        <div id={panelId} hidden={!managing}>
          {managing && <ManagePages id={id} />}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
