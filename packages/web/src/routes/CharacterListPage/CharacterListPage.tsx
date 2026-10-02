import { ErrorState } from "../../ErrorState.tsx";
import { useCharacters } from "../../hooks/useCharacters.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { CharacterTile } from "./CharacterTile.tsx";

export function CharacterListPage() {
  const { data, isPending, isError, error } = useCharacters();
  const loaded = !isPending && !isError;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="font-bold text-[22px]">Characters</h1>
        {loaded && (
          <p className="mt-0.5 text-body text-muted">
            {data.length === 1 ? "1 character" : `${data.length} characters`}
          </p>
        )}
      </div>
      {isPending && <LoadingState label="Loading characters…" />}
      {isError && <ErrorState message={error.message} />}
      {loaded && data.length === 0 && (
        <div className="flex flex-col items-center gap-2.5 rounded-card border-2 border-border border-dashed px-3 py-24 text-center">
          <p className="font-semibold text-sm">No characters yet</p>
          <p className="text-body text-muted leading-normal">Characters you add appear here.</p>
        </div>
      )}
      {loaded && data.length > 0 && (
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
