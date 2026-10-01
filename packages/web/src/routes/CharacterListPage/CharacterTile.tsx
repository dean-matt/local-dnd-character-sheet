import type { CharacterRecord } from "@dnd/character";
import { Link } from "react-router";
import { avatarColor } from "../../lib/avatarColor.ts";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";

export function CharacterTile({ character }: { character: CharacterRecord }) {
  const summary = [character.raceSummary, character.classSummary].filter(Boolean).join(" ");
  return (
    <Link
      to={`/characters/${character.id}`}
      className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4.5"
    >
      <div className="truncate font-semibold text-title">{character.name}</div>
      <div className="truncate text-muted text-row">
        {summary} • Lvl {character.level}
      </div>
      {/* Drawn first but read last, so a link's name opens with the character's. */}
      <div className="order-first flex items-center justify-between">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full font-semibold text-[17px] text-white"
          style={{ background: avatarColor(character.id) }}
        >
          {[...character.name][0]?.toUpperCase()}
        </span>
        <span className="rounded-chip border border-border bg-canvas px-1.5 py-0.75 font-bold text-chip text-secondary uppercase tracking-chip">
          {EDITION_LABELS[character.edition]}
        </span>
      </div>
    </Link>
  );
}
