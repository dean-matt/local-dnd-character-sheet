import { useParams, useSearchParams } from "react-router";
import { PageBlocks } from "../../components/blocks/PageBlocks.tsx";
import { SaveOverride } from "../../components/overrideContext.ts";
import { ErrorState } from "../../ErrorState.tsx";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { useCharacterDerived } from "../../hooks/useCharacterDerived.ts";
import { useCharacterPages } from "../../hooks/useCharacterPages.ts";
import { useSaveOverride } from "../../hooks/useSaveOverride.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { NotFoundPanel } from "../NotFoundPanel.tsx";
import { PageEditor } from "./PageEditor.tsx";

/**
 * A page renders its blocks whether or not the character and its derived block have
 * loaded — a block that reads either shows as unavailable while it is in flight or when
 * the API could not answer. `?edit` in the URL opens the page's editor in place of its
 * blocks, so a page just created lands ready to build.
 */
export function CharacterPage() {
  const { id = "", slug = "" } = useParams();
  const pages = useCharacterPages(id);
  const character = useCharacter(id);
  const derived = useCharacterDerived(id);
  const saveOverride = useSaveOverride(id);
  const [params, setParams] = useSearchParams();
  const editing = params.has("edit");

  if (pages.isPending) return <LoadingState label="Loading pages…" />;
  if (pages.isError) return <ErrorState error={pages.error} />;

  const page = pages.data.find((candidate) => candidate.slug === slug);
  if (!page) return <NotFoundPanel />;

  return (
    <section aria-label={page.title}>
      <div className="mb-3 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => setParams(editing ? {} : { edit: "" }, { replace: true })}
          className="rounded-control border border-border px-3 py-1.5 text-ink text-row hover:bg-subtle"
        >
          {editing ? "Done editing" : "Edit page"}
        </button>
      </div>
      {editing ? (
        <PageEditor id={id} page={page} />
      ) : (
        <div className="flex flex-col gap-3">
          {character.isError && <ErrorState error={character.error} />}
          {derived.isPending && <LoadingState label="Loading derived values…" />}
          {derived.isError && <ErrorState error={derived.error} />}
          <SaveOverride.Provider value={saveOverride}>
            <PageBlocks blocks={page.blocks} character={character.data} derived={derived.data} />
          </SaveOverride.Provider>
        </div>
      )}
    </section>
  );
}
