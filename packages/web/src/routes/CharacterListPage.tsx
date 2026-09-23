import { Link } from "react-router";
import { useCharacters } from "../hooks/useCharacters.ts";
import { EmptyState, ErrorState, LoadingState } from "../states.tsx";

export function CharacterListPage() {
  const { data, isPending, isError, error } = useCharacters();

  return (
    <section>
      <h1 className="font-semibold text-2xl">local-dnd-character-sheet</h1>
      <div className="mt-4">
        {isPending && <LoadingState label="Loading characters…" />}
        {isError && <ErrorState message={error.message} />}
        {!isPending && !isError && data.length === 0 && <EmptyState>No characters yet.</EmptyState>}
        {!isPending && !isError && data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.map((character) => (
              <li key={character.id}>
                <Link
                  to={`/characters/${character.id}`}
                  className="block rounded-card border border-border bg-surface p-4 text-row"
                >
                  {character.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
