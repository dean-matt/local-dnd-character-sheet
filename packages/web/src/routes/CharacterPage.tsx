import { useParams } from "react-router";
import { PageBlocks } from "../components/blocks/PageBlocks.tsx";
import { ErrorState } from "../ErrorState.tsx";
import { useCharacter } from "../hooks/useCharacter.ts";
import { useCharacterDerived } from "../hooks/useCharacterDerived.ts";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { LoadingState } from "../LoadingState.tsx";
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
  if (pages.isError) return <ErrorState error={pages.error} />;

  const page = pages.data.find((candidate) => candidate.slug === slug);
  if (!page) return <NotFoundPanel />;

  return (
    <section aria-label={page.title}>
      <div className="flex flex-col gap-4">
        {character.isError && <ErrorState error={character.error} />}
        {derived.isPending && <LoadingState label="Loading derived values…" />}
        {derived.isError && <ErrorState error={derived.error} />}
        <PageBlocks blocks={page.blocks} character={character.data} derived={derived.data} />
      </div>
    </section>
  );
}
