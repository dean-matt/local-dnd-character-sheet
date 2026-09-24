import type { CharacterRecord } from "@dnd/character";
import { Link } from "react-router";
import { Field } from "../components/Field.tsx";
import { useCharacters } from "../hooks/useCharacters.ts";
import { EmptyState, ErrorState, LoadingState } from "../states.tsx";

const EDITION_LABELS: Record<CharacterRecord["edition"], string> = {
  classic: "Classic",
  one: "One",
};

const formatName = (name: string) => name;

export function CharacterListPage() {
  const { data, isPending, isError, error } = useCharacters();

  return (
    <section>
      <h1 className="font-semibold text-2xl">local-dnd-character-sheet</h1>
      <div className="mt-4">
        {isPending && <LoadingState label="Loading characters…" />}
        {isError && <ErrorState message={error.message} />}
        {!isPending && !isError && data.length === 0 && (
          <EmptyState>
            No characters yet. POST a definition to http://127.0.0.1:8787/characters to add one.
          </EmptyState>
        )}
        {!isPending && !isError && data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.map((character) => (
              <li key={character.id}>
                <Link
                  to={`/characters/${character.id}`}
                  className="block rounded-card border border-border bg-surface p-4 text-row"
                >
                  <Field
                    mode="read"
                    label="Name"
                    value={{ computed: character.name, manual: null }}
                    format={formatName}
                    labelHidden
                  />
                  <p className="mt-1 text-muted text-row">
                    {character.raceSummary} {character.classSummary} · Level {character.level} ·{" "}
                    {EDITION_LABELS[character.edition]}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
