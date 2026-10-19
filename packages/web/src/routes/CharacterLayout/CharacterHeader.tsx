import type { CharacterRecord } from "@dnd/character";
import type { ReactNode } from "react";
import { EditionTag } from "../../components/EditionTag.tsx";
import { headerSubtitle } from "./characterSubtitle.ts";
import { PortraitUpload } from "./PortraitUpload.tsx";
import { SaveIndicator } from "./SaveIndicator.tsx";

/**
 * Sits above every page of a character on screen, pinned under the top bar in a `tall`
 * window; print carries `PrintTitle` instead. Its height is `--spacing-header`, which
 * `index.css` adds to `scroll-padding-top` while it is mounted, so focus never lands under
 * it. Name and subtitle truncate rather than wrap, holding that height. The save status
 * and then `actions` sit at the right, where the mockup puts its 32px buttons.
 */
export function CharacterHeader({
  character,
  actions,
}: {
  character: CharacterRecord;
  actions?: ReactNode;
}) {
  const subtitle = headerSubtitle(character);
  return (
    <div
      data-character-header
      className="top-topbar z-20 flex h-header tall:sticky items-center gap-3 border-b border-border bg-surface px-gutter print:hidden"
    >
      <PortraitUpload character={character} />
      <div className="flex min-w-0 grow items-baseline gap-2">
        <h1 title={character.name} className="min-w-0 truncate font-bold text-lg">
          {character.name}
        </h1>
        <EditionTag edition={character.edition} />
        {/* The mockup's 160px floor, capped at half the name block so a narrow window splits the line rather than overflowing. */}
        <p
          title={subtitle}
          className="min-w-[min(--spacing(40),50%)] flex-1 basis-0 truncate text-body text-muted"
        >
          {subtitle}
        </p>
      </div>
      <SaveIndicator characterId={character.id} />
      {actions}
    </div>
  );
}
