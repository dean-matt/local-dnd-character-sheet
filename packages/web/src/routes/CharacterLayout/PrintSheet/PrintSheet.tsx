import type { CharacterPageRecord } from "@dnd/character";
import { PageBlocks } from "../../../components/blocks/PageBlocks.tsx";
import { ErrorState } from "../../../ErrorState.tsx";
import { useCharacter } from "../../../hooks/useCharacter.ts";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { PrintTitle } from "./PrintTitle.tsx";

/**
 * Every page the nav lists, each starting a new sheet, which the browser's print lays
 * out in place of the one page on screen. `index.css` shows it in print alone. It mounts
 * with the screen page rather than on `beforeprint` because print lays out synchronously
 * after that event, so a section still fetching would print as its loading state. The cost
 * is every visible page's requests and a second render of the current page on every
 * character route, growing with the pages a character keeps; past what a local sheet
 * shrugs off, mount it on the first `beforeprint` and keep it mounted.
 */
export function PrintSheet({
  id,
  pages,
  pagesError,
}: {
  id: string;
  pages: CharacterPageRecord[];
  pagesError: Error | null;
}) {
  const character = useCharacter(id);
  const derived = useCharacterDerived(id);
  return (
    <div hidden data-print-sheet>
      {character.data && <PrintTitle character={character.data} />}
      {pagesError && <ErrorState message={pagesError.message} />}
      {character.isError && <ErrorState message={character.error.message} />}
      {derived.isError && <ErrorState message={derived.error.message} />}
      {pages.map((page) => (
        <section key={page.slug} className="break-before-page first-of-type:break-before-auto">
          <h1 className="font-semibold text-2xl">{page.title}</h1>
          <div className="mt-4">
            <PageBlocks blocks={page.blocks} character={character.data} derived={derived.data} />
          </div>
        </section>
      ))}
    </div>
  );
}
