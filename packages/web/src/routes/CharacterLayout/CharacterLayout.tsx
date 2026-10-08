import { useRef, useState } from "react";
import { Outlet, useParams } from "react-router";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { useCharacterPages } from "../../hooks/useCharacterPages.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { CharacterHeader } from "./CharacterHeader.tsx";
import { CharacterSidebar } from "./CharacterSidebar.tsx";
import { DeleteCharacter } from "./DeleteCharacter.tsx";
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
                  <DeleteCharacter character={character.data} />
                </>
              }
            />
          )}
          <div className="px-gutter py-6">
            <Outlet />
          </div>
        </div>
      </SidebarFrame>

      {managing && <ManagePages id={id} onClose={closeManage} />}

      <PrintSheet id={id} pages={pages} pagesError={pagesQuery.error} />
    </>
  );
}
