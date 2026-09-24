import { useParams } from "react-router";
import { PageBlocks } from "../components/blocks/PageBlocks.tsx";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { useCharacter } from "../hooks/useCharacters.ts";
import { ErrorState, LoadingState } from "../states.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

/**
 * A page renders its blocks whether or not the character has loaded yet — a `value`
 * block degrades exactly like a missing field. Nothing yet resolves a real
 * `CharacterDerived` for a stored character, so every `value` block reads as
 * unavailable until the section that computes it ships.
 */
export function CharacterPage() {
  const { id = "", slug = "" } = useParams();
  const pages = useCharacterPages(id);
  const { isPending, isError, error } = useCharacter(id);

  if (pages.isPending) return <LoadingState label="Loading pages…" />;
  if (pages.isError) return <ErrorState message={pages.error.message} />;

  const page = pages.data.find((candidate) => candidate.slug === slug);
  if (!page) return <NotFoundPanel />;

  return (
    <section>
      <h1 className="font-semibold text-2xl">{page.title}</h1>
      <div className="mt-4 flex flex-col gap-4">
        {isPending && <LoadingState label="Loading character…" />}
        {isError && <ErrorState message={error.message} />}
        <PageBlocks blocks={page.blocks} derived={undefined} />
      </div>
    </section>
  );
}
