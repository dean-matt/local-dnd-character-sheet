import type { CharacterPageRecord } from "@dnd/character";
import { useId, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { PageBlocks } from "../components/blocks/PageBlocks.tsx";
import { useCharacterDerived } from "../hooks/useCharacterDerived.ts";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { useCharacter } from "../hooks/useCharacters.ts";
import { ManagePages } from "./ManagePages.tsx";

export function CharacterLayout() {
  const { id = "" } = useParams();
  const pages = useCharacterPages(id).data?.filter((page) => !page.hidden) ?? [];
  const [managing, setManaging] = useState(false);
  const panelId = useId();

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row print:hidden">
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
      <PrintSheet id={id} pages={pages} />
    </>
  );
}

/**
 * Every page the nav lists, each starting a new sheet, which the browser's print lays
 * out in place of the one page on screen. `index.css` shows it in print alone. It mounts
 * with the screen page rather than on `beforeprint` because print lays out synchronously
 * after that event, so a section still fetching would print as its loading state.
 */
function PrintSheet({ id, pages }: { id: string; pages: CharacterPageRecord[] }) {
  const character = useCharacter(id);
  const derived = useCharacterDerived(id);
  return (
    <div hidden data-print-sheet>
      {pages.map((page) => (
        <section key={page.slug} className="break-before-page first:break-before-auto">
          <h1 className="font-semibold text-2xl">{page.title}</h1>
          <div className="mt-4">
            <PageBlocks blocks={page.blocks} character={character.data} derived={derived.data} />
          </div>
        </section>
      ))}
    </div>
  );
}
