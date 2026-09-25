import { useParams } from "react-router";
import { PageBlocks } from "../components/blocks/PageBlocks.tsx";
import { useCharacterDerived } from "../hooks/useCharacterDerived.ts";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { ErrorState, LoadingState } from "../states.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

/**
 * A page renders its blocks whether or not the derived block has loaded — a `value`
 * block reads as unavailable while it is in flight or when the API could not compute it.
 */
export function CharacterPage() {
  const { id = "", slug = "" } = useParams();
  const pages = useCharacterPages(id);
  const derived = useCharacterDerived(id);

  if (pages.isPending) return <LoadingState label="Loading pages…" />;
  if (pages.isError) return <ErrorState message={pages.error.message} />;

  const page = pages.data.find((candidate) => candidate.slug === slug);
  if (!page) return <NotFoundPanel />;

  return (
    <section>
      <h1 className="font-semibold text-2xl">{page.title}</h1>
      <div className="mt-4 flex flex-col gap-4">
        {derived.isPending && <LoadingState label="Loading derived values…" />}
        {derived.isError && <ErrorState message={derived.error.message} />}
        <PageBlocks blocks={page.blocks} derived={derived.data} />
      </div>
    </section>
  );
}
