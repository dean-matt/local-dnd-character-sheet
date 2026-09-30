import type { CharacterRecord } from "@dnd/character";
import { Link } from "react-router";
import { useCharacters } from "../hooks/useCharacters.ts";
import { avatarColor } from "../lib/avatarColor.ts";
import { ErrorState, LoadingState } from "../states.tsx";

const EDITION_LABELS: Record<CharacterRecord["edition"], string> = {
  classic: "2014",
  one: "2024",
};

function CharacterTile({ character }: { character: CharacterRecord }) {
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

export function CharacterListPage() {
  const { data, isPending, isError, error } = useCharacters();

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="font-bold text-[22px]">Characters</h1>
        {data && (
          <p className="mt-0.5 text-body text-muted">
            {data.length === 1 ? "1 character" : `${data.length} characters`}
          </p>
        )}
      </div>
      {isPending && <LoadingState label="Loading characters…" />}
      {isError && <ErrorState message={error.message} />}
      {!isPending && !isError && data.length === 0 && (
        <div className="flex flex-col items-center gap-2.5 rounded-card border-2 border-border border-dashed px-3 py-24 text-center">
          <p className="font-semibold text-sm">No characters yet</p>
          <p className="text-body text-muted leading-normal">Characters you add appear here.</p>
        </div>
      )}
      {!isPending && !isError && data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((character) => (
            <li key={character.id} className="min-w-0">
              <CharacterTile character={character} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
