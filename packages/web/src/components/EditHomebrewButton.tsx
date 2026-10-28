import { lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { useCatalogRow } from "../hooks/useCatalogRow.ts";
import { useHomebrew } from "../hooks/useHomebrew.ts";
import { useReturnFocus } from "../hooks/useReturnFocus.ts";
import { matchCatalogTarget } from "../lib/catalogRows.ts";
import { LISTING_KINDS } from "../lib/homebrewListing.ts";
import { ResolvedRefs } from "./resolvedRefsContext.ts";

// Its own chunk, so a sheet loads the JSON editor only once Edit is pressed.
const loadEditor = () =>
  import("./HomebrewEditor/HomebrewEditor.tsx").then((module) => ({
    default: module.HomebrewEditor,
  }));
const HomebrewEditor = lazy(loadEditor);

/**
 * Edit for a homebrew item or spell's detail on a sheet: opens the Settings › Homebrew
 * editor on the stored row as a second dialog over the detail, and takes focus back on every
 * close. It draws nothing until the row is read, which `CatalogEntry` has usually cached.
 */
export function EditHomebrewButton({
  collection,
  id,
}: {
  collection: "items" | "spells";
  id: string;
}) {
  const row = useCatalogRow(
    matchCatalogTarget(`/homebrew/${collection}/${encodeURIComponent(id)}`),
  );
  const kind = LISTING_KINDS[collection];
  const { save } = useHomebrew(collection, kind.recordSchema, { listed: false });
  const [editorOpen, setEditorOpen] = useState(false);
  const button = useReturnFocus<HTMLButtonElement>(editorOpen);
  const homebrew = row.data?.homebrew;
  if (!homebrew) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          save.reset();
          setEditorOpen(true);
        }}
        className="rounded-control border border-border bg-surface px-3.5 py-2 font-semibold text-ink text-row hover:bg-subtle"
      >
        Edit
      </button>
      {editorOpen &&
        createPortal(
          // A block of its own: the map of the sheet that opened it holds none of this row's references.
          <ResolvedRefs value={null}>
            <Suspense fallback={null}>
              <HomebrewEditor
                collection={collection}
                record={homebrew.record}
                saving={save.isPending}
                failure={save.error?.message}
                onSave={(input) =>
                  save.mutate({ id, input }, { onSuccess: () => setEditorOpen(false) })
                }
                onClose={() => setEditorOpen(false)}
                appliesToAll
              />
            </Suspense>
          </ResolvedRefs>,
          document.body,
        )}
    </>
  );
}
