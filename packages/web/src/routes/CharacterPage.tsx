import { useParams } from "react-router";
import { PageBlocks } from "../components/blocks/PageBlocks.tsx";
import { useCharacterDerived } from "../hooks/useCharacterDerived.ts";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { useCharacter } from "../hooks/useCharacters.ts";
import { ErrorState, LoadingState } from "../states.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

/**
 * A page renders its blocks whether or not the character and its derived block have
 * loaded — a block that reads either shows as unavailable while it is in flight or when
 * the API could not answer.
 */
export function CharacterPage() {
  const { id = "", slug = "" } = useParams();
  const pages = useCharacterPages(id);
  const character = useCharacter(id);
  const derived = useCharacterDerived(id);

  if (pages.isPending) return <LoadingState label="Loading pages…" />;
  if (pages.isError) return <ErrorState message={pages.error.message} />;

  const page = pages.data.find((candidate) => candidate.slug === slug);
  if (!page) return <NotFoundPanel />;

  return (
    <section>
      <h1 className="font-semibold text-2xl">{page.title}</h1>
      <div className="mt-4 flex flex-col gap-4">
        {character.isError && <ErrorState message={character.error.message} />}
        {derived.isPending && <LoadingState label="Loading derived values…" />}
        {derived.isError && <ErrorState message={derived.error.message} />}
        <PageBlocks blocks={page.blocks} character={character.data} derived={derived.data} />
      </div>
    </section>
  );
}
