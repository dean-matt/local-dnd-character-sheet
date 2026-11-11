import type { rollLogEntrySchema } from "@dnd/character";
import { Settings } from "lucide-react";
import { useId, useRef, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import type { z } from "zod";
import { CollapseToggle } from "../../components/CollapseToggle.tsx";
import { OnRolled, RollingFor } from "../../components/rollerContext.ts";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { useCharacterPages } from "../../hooks/useCharacterPages.ts";
import { useReturnFocus } from "../../hooks/useReturnFocus.ts";
import { SidebarFrame } from "../SidebarFrame.tsx";
import { CharacterHeader } from "./CharacterHeader.tsx";
import { CharacterSidebar } from "./CharacterSidebar.tsx";
import { Dock } from "./Dock.tsx";
import { InspirationButton } from "./InspirationButton.tsx";
import { ManagePages } from "./ManagePages/ManagePages.tsx";
import { PrintSheet } from "./PrintSheet/PrintSheet.tsx";
import { RestMenu } from "./RestMenu/RestMenu.tsx";
import { RollLog } from "./RollLog/RollLog.tsx";
import { RollLogButton } from "./RollLogButton.tsx";
import { UndoHistory } from "./UndoHistory/UndoHistory.tsx";
import { UndoHistoryButton } from "./UndoHistoryButton.tsx";

export function CharacterLayout() {
  const { id = "" } = useParams();
  const pagesQuery = useCharacterPages(id);
  const pages = pagesQuery.data?.filter((page) => !page.hidden) ?? [];
  const character = useCharacter(id);
  const [managing, setManaging] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"history" | "rolls" | null>(null);
  const [latestRoll, setLatestRoll] = useState<z.infer<typeof rollLogEntrySchema> | null>(null);
  const [rollsCollapsed, setRollsCollapsed] = useState(false);
  const historyOpen = panel === "history";
  const rollsOpen = panel === "rolls";
  const historyButtonRef = useReturnFocus<HTMLButtonElement>(historyOpen);
  const rollsButtonRef = useReturnFocus<HTMLButtonElement>(rollsOpen);
  const closePanel = () => {
    setLatestRoll(null);
    setRollsCollapsed(false);
    setPanel(null);
  };
  const toggle = (which: "history" | "rolls") => () => {
    setLatestRoll(null);
    setRollsCollapsed(false);
    setPanel((open) => (open === which ? null : which));
  };
  const showRoll = (roll: z.infer<typeof rollLogEntrySchema>) => {
    setLatestRoll(roll);
    setPanel("rolls");
  };
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
                  <InspirationButton characterId={id} />
                  <RestMenu character={character.data} />
                  <UndoHistoryButton
                    ref={historyButtonRef}
                    characterId={id}
                    panelId={dockId}
                    open={historyOpen}
                    onToggle={toggle("history")}
                  />
                  <RollLogButton
                    ref={rollsButtonRef}
                    panelId={dockId}
                    open={rollsOpen}
                    onToggle={toggle("rolls")}
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
            <RollingFor value={id}>
              <OnRolled value={showRoll}>
                <Outlet />
              </OnRolled>
            </RollingFor>
          </div>
        </div>
        {panel && (
          <Dock
            id={dockId}
            label="Side panel"
            onClose={closePanel}
            collapsed={rollsOpen && rollsCollapsed}
          >
            {historyOpen ? (
              <UndoHistory characterId={id} />
            ) : (
              <OnRolled value={showRoll}>
                <RollLog latest={latestRoll} characterId={id} collapsed={rollsCollapsed} />
                <div className="mt-2.5 shrink-0 border-border border-t pt-3">
                  <CollapseToggle
                    name="Roll Log"
                    edge="right"
                    collapsed={rollsCollapsed}
                    onToggle={() => setRollsCollapsed((collapsed) => !collapsed)}
                  />
                </div>
              </OnRolled>
            )}
          </Dock>
        )}
      </SidebarFrame>

      {managing && <ManagePages id={id} onClose={closeManage} />}

      <PrintSheet id={id} pages={pages} pagesError={pagesQuery.error} />
    </>
  );
}
