import { Settings } from "lucide-react";
import { useId, useRef, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { useCharacterPages } from "../../hooks/useCharacterPages.ts";
import { useReturnFocus } from "../../hooks/useReturnFocus.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { CharacterHeader } from "./CharacterHeader.tsx";
import { CharacterSidebar } from "./CharacterSidebar.tsx";
import { Dock } from "./Dock.tsx";
import { ManagePages } from "./ManagePages/ManagePages.tsx";
import { PrintSheet } from "./PrintSheet/PrintSheet.tsx";
import { UndoHistory } from "./UndoHistory/UndoHistory.tsx";
import { UndoHistoryButton } from "./UndoHistoryButton.tsx";

export function CharacterLayout() {
  const { id = "" } = useParams();
  const pagesQuery = useCharacterPages(id);
  const pages = pagesQuery.data?.filter((page) => !page.hidden) ?? [];
  const character = useCharacter(id);
  const [managing, setManaging] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyButtonRef = useReturnFocus<HTMLButtonElement>(historyOpen);
  const dockId = useId();

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
                  <UndoHistoryButton
                    ref={historyButtonRef}
                    characterId={id}
                    panelId={dockId}
                    open={historyOpen}
                    onToggle={() => setHistoryOpen((open) => !open)}
                  />
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
        {historyOpen && (
          <Dock id={dockId} label="Side panel" onCollapse={() => setHistoryOpen(false)}>
            <UndoHistory characterId={id} />
          </Dock>
        )}
      </SidebarFrame>

      {managing && <ManagePages id={id} onClose={closeManage} />}

      <PrintSheet id={id} pages={pages} pagesError={pagesQuery.error} />
    </>
  );
}
