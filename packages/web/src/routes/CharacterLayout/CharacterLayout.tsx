import { Settings } from "lucide-react";
import { useRef, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { useCharacterPages } from "../../hooks/useCharacterPages.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { CharacterHeader } from "./CharacterHeader.tsx";
import { CharacterSidebar } from "./CharacterSidebar.tsx";
import { ManagePages } from "./ManagePages/ManagePages.tsx";
import { PrintSheet } from "./PrintSheet/PrintSheet.tsx";
import { UndoButton } from "./UndoButton.tsx";

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
      <SidebarFrame
        rail={
          <CharacterSidebar
            characterId={id}
            pages={pages}
            onManage={openManage}
            manageButtonRef={manageButtonRef}
          />
        }
      >
        <div className="min-w-0 flex-1">
          {character.data && (
            <CharacterHeader
              character={character.data}
              actions={
                <>
                  <UndoButton characterId={id} />
                  <NavLink
                    to={`/characters/${id}/settings`}
                    title="Character settings"
                    aria-label="Character settings"
                    className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-[current=page]:text-ink"
                  >
                    <Settings size={16} aria-hidden="true" />
                  </NavLink>
                </>
              }
            />
          )}
          <div className="px-gutter py-4">
            <Outlet />
          </div>
        </div>
      </SidebarFrame>

      {managing && <ManagePages id={id} onClose={closeManage} />}

      <PrintSheet id={id} pages={pages} pagesError={pagesQuery.error} />
    </>
  );
}
