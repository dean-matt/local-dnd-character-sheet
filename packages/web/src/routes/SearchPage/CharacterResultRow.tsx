import type { CharacterRecord } from "@dnd/character";
import { Link } from "react-router";
import { TypeChip } from "../../components/TypeChip.tsx";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";

/** One of the user's characters on the search page, its name opening its sheet. */
export function CharacterResultRow({ character }: { character: CharacterRecord }) {
  return (
    <li className="flex items-center gap-3 rounded-control border border-border bg-surface px-3.5 py-2.5">
      <TypeChip type="character">Character</TypeChip>
      <span className="min-w-0 grow">
        <Link
          to={`/characters/${character.id}`}
          className="block truncate text-body font-semibold text-accent-text hover:underline"
        >
          {character.name}
        </Link>
        <span className="block truncate text-label text-muted">
          {character.raceSummary} {character.classSummary} • Lvl {character.level} •{" "}
          {EDITION_LABELS[character.edition]} rules
        </span>
      </span>
    </li>
  );
}
