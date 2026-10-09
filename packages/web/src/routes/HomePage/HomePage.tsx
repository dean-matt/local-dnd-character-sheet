import { ChevronRight, FlaskConical, Search, Settings } from "lucide-react";
import { Link } from "react-router";
import { CharacterActions } from "../../components/CharacterActions.tsx";
import { CharacterTile } from "../../components/CharacterTile.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useCharacters } from "../../hooks/useCharacters.ts";
import { useSearchTypes } from "../../hooks/useSearchTypes.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { MECHANICS_ENTRIES, mechanicsHref } from "../../lib/mechanicsEntries.ts";
import { HomeQuickLink } from "./HomeQuickLink.tsx";

const RECENT_LIMIT = 4;

/** The catalog's types alone: Weapons and Armor narrow items rather than name a type. */
const CATALOG_TYPES = MECHANICS_ENTRIES.filter((entry) => entry.kind === undefined);

/**
 * The index route's dashboard: the most recently changed characters, then quick links to
 * Search, Settings, Homebrew and each catalog type the search can return.
 */
export function HomePage() {
  const characters = useCharacters();
  const types = useSearchTypes();
  const searchable = new Set(types.data ?? []);
  const catalogTypes = CATALOG_TYPES.filter(({ type }) => searchable.has(type));
  const loaded = !characters.isPending && !characters.isError;
  const hasCharacters = loaded && characters.data.length > 0;
  // `characters` keeps no time a character was last opened, so a changed definition stands in.
  const recent = hasCharacters
    ? characters.data
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, RECENT_LIMIT)
    : [];

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="home-recent" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 id="home-recent" className="font-bold text-[22px]">
              {loaded && !hasCharacters ? "Welcome to Local D&D" : "Recent characters"}
            </h1>
            {hasCharacters && (
              <Link
                to="/characters"
                className="mt-0.5 inline-block font-semibold text-accent-text text-body"
              >
                See all characters →
              </Link>
            )}
          </div>
          {hasCharacters && <CharacterActions />}
        </div>
        {characters.isPending && <LoadingState label="Loading characters…" />}
        {characters.isError && <ErrorState message={characters.error.message} />}
        {hasCharacters && (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((character) => (
              <li key={character.id} className="min-w-0">
                <CharacterTile character={character} />
              </li>
            ))}
          </ul>
        )}
        {loaded && !hasCharacters && (
          <div className="flex flex-col items-center gap-2.5 rounded-card border-2 border-border border-dashed px-3 py-12 text-center">
            <p className="font-semibold text-sm">No characters yet</p>
            <p className="text-body text-muted leading-normal">
              Start one from scratch, or import a character you already have.
            </p>
            <CharacterActions newFirst />
          </div>
        )}
      </section>

      <section aria-labelledby="home-explore" className="flex flex-col gap-3.5">
        <h2 id="home-explore" className="font-bold text-base">
          Explore
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <li className="min-w-0">
            <HomeQuickLink
              to="/search"
              icon={Search}
              label="Search"
              description="Every character and the whole compendium, with filters"
            />
          </li>
          <li className="min-w-0">
            <HomeQuickLink
              to="/settings"
              icon={Settings}
              label="Settings"
              description="Theme, accent and which sources to search"
            />
          </li>
          <li className="min-w-0">
            <HomeQuickLink
              to="/settings/homebrew"
              icon={FlaskConical}
              label="Homebrew"
              description="Your own items and spells, written as 5etools entries"
            />
          </li>
        </ul>
        {types.isError && <p className="text-body text-error">The catalog's types did not load.</p>}
        {catalogTypes.length > 0 && (
          <>
            <h3
              id="home-compendium"
              className="mt-1.5 font-semibold text-[10px] text-muted uppercase tracking-label"
            >
              Compendium
            </h3>
            <ul
              aria-labelledby="home-compendium"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
            >
              {catalogTypes.map((entry) => (
                <li key={entry.label} className="min-w-0">
                  <Link
                    to={mechanicsHref(entry)}
                    className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface px-3.5 py-2.5 font-medium text-body text-ink hover:bg-subtle"
                  >
                    <span className="truncate">{entry.label}</span>
                    <ChevronRight
                      aria-hidden="true"
                      size={12}
                      strokeWidth={2.5}
                      className="shrink-0 text-muted"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
