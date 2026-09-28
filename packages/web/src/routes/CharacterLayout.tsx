import type { CharacterPageRecord } from "@dnd/character";
import { useRef, useState } from "react";
import { Outlet, useParams } from "react-router";
import { PageBlocks } from "../components/blocks/PageBlocks.tsx";
import { useCharacterDerived } from "../hooks/useCharacterDerived.ts";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { useCharacter } from "../hooks/useCharacters.ts";
import { ErrorState } from "../states.tsx";
import { CharacterHeader, PrintTitle } from "./CharacterHeader.tsx";
import { ManagePages } from "./ManagePages.tsx";
import { Sidebar } from "./Sidebar.tsx";

export function CharacterLayout() {
  const { id = "" } = useParams();
  const pagesQuery = useCharacterPages(id);
  const pages = pagesQuery.data?.filter((page) => !page.hidden) ?? [];
  const character = useCharacter(id);
  const [managing, setManaging] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement>(null);

  const openManage = () => setManaging(true);
  const closeManage = () => {
    setManaging(false);
    // Return focus to the trigger after React re-renders
    setTimeout(() => manageButtonRef.current?.focus(), 0);
  };

  return (
    <>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="self-start sticky top-16 shrink-0 p-5 print:hidden">
          <Sidebar
            characterId={id}
            pages={pages}
            onManage={openManage}
            manageButtonRef={manageButtonRef}
          />
        </aside>

        <div className="min-w-0 flex-1 px-10 py-6">
          {character.data && <CharacterHeader character={character.data} />}
          <Outlet />
        </div>
      </div>

      {managing && <ManagePages id={id} onClose={closeManage} />}

      <PrintSheet id={id} pages={pages} pagesError={pagesQuery.error} />
    </>
  );
}

/**
 * Every page the nav lists, each starting a new sheet, which the browser's print lays
 * out in place of the one page on screen. `index.css` shows it in print alone. It mounts
 * with the screen page rather than on `beforeprint` because print lays out synchronously
 * after that event, so a section still fetching would print as its loading state. The cost
 * is every visible page's requests and a second render of the current page on every
 * character route, growing with the pages a character keeps; past what a local sheet
 * shrugs off, mount it on the first `beforeprint` and keep it mounted.
 */
function PrintSheet({
  id,
  pages,
  pagesError,
}: {
  id: string;
  pages: CharacterPageRecord[];
  pagesError: Error | null;
}) {
  const character = useCharacter(id);
  const derived = useCharacterDerived(id);
  return (
    <div hidden data-print-sheet>
      {character.data && <PrintTitle character={character.data} />}
      {pagesError && <ErrorState message={pagesError.message} />}
      {character.isError && <ErrorState message={character.error.message} />}
      {derived.isError && <ErrorState message={derived.error.message} />}
      {pages.map((page) => (
        <section key={page.slug} className="break-before-page first-of-type:break-before-auto">
          <h1 className="font-semibold text-2xl">{page.title}</h1>
          <div className="mt-4">
            <PageBlocks blocks={page.blocks} character={character.data} derived={derived.data} />
          </div>
        </section>
      ))}
    </div>
  );
}
