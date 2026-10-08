import type { CharacterRecord } from "@dnd/character";
import { EllipsisVertical } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useDuplicateCharacter } from "../../hooks/useDuplicateCharacter.ts";
import { useReturnFocus } from "../../hooks/useReturnFocus.ts";
import { DeleteCharacterDialog } from "./DeleteCharacterDialog.tsx";

const ITEM = "block w-full rounded-control px-2.5 py-2 text-left text-row hover:bg-subtle";

/**
 * The header's Character menu: Duplicate opens the copy once it lands, and Delete opens
 * the confirmation. Arrow keys move between items, Escape closes and returns focus to the
 * button, and focus leaving the menu closes it.
 */
export function CharacterMenu({ character }: { character: CharacterRecord }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const trigger = useReturnFocus<HTMLButtonElement>(deleting);
  const menu = useRef<HTMLDivElement>(null);
  const duplicate = useDuplicateCharacter(character.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (menuOpen) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    trigger.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!menuOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = {
      ArrowDown: (at + 1) % items.length,
      ArrowUp: (at - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape, the arrow keys and focusout bubbling from the button and the menu. */}
      <div
        className="relative flex shrink-0 items-center gap-2"
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
        }}
      >
        {duplicate.isError && (
          <p role="alert" className="text-error text-row">
            Duplicate failed: {duplicate.error.message}
          </p>
        )}
        <button
          ref={trigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          title="Character menu"
          className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle"
        >
          <EllipsisVertical size={16} aria-hidden="true" />
          <span className="sr-only">Character menu</span>
        </button>
        {menuOpen && (
          <div
            ref={menu}
            role="menu"
            aria-label="Character menu"
            className="absolute top-full right-0 z-30 mt-1 w-44 rounded-card border border-border bg-surface p-1.5 shadow-popover"
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={duplicate.isPending}
              onClick={() => {
                if (duplicate.isPending) return;
                closeMenu();
                duplicate.mutate(undefined, {
                  onSuccess: (copy) => navigate(`/characters/${copy.id}`),
                });
              }}
              className={`${ITEM} text-ink aria-disabled:cursor-wait aria-disabled:opacity-60`}
            >
              Duplicate character
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setMenuOpen(false);
                setDeleting(true);
              }}
              className={`${ITEM} text-accent`}
            >
              Delete character
            </button>
          </div>
        )}
      </div>
      {deleting && (
        <DeleteCharacterDialog character={character} onClose={() => setDeleting(false)} />
      )}
    </>
  );
}
