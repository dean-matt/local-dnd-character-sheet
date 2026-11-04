import { Plus, X } from "lucide-react";
import { useContext, useEffect, useId, useRef, useState } from "react";
import { EditionTag } from "../../components/EditionTag.tsx";
import { HomebrewEditor } from "../../components/HomebrewEditor/HomebrewEditor.tsx";
import { ListRow } from "../../components/ListRow/ListRow.tsx";
import { RulesEntries } from "../../components/RulesEntries/RulesEntries.tsx";
import { Tag } from "../../components/Tag.tsx";
import { EmptyState } from "../../EmptyState.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useHomebrew } from "../../hooks/useHomebrew.ts";
import { useHomebrewHistory } from "../../hooks/useHomebrewHistory.ts";
import { LoadingState } from "../../LoadingState.tsx";
import type { HomebrewRow, ListingKind } from "../../lib/homebrewListing.ts";
import { firstLine } from "../../lib/rulesProse.ts";
import { DeletedToast } from "./DeletedToast.tsx";
import { DeleteHomebrewDialog } from "./DeleteHomebrewDialog.tsx";
import { ExportHomebrew } from "./ExportHomebrew.tsx";
import { ExportSelection } from "./exportSelectionContext.ts";
import { ImportHomebrew } from "./ImportHomebrew.tsx";

/**
 * One kind of homebrew: the page's import, export and add on one row, then its rows, each
 * deletable from the card and editable from its detail.
 */
export function HomebrewSection({ kind }: { kind: ListingKind }) {
  const { list, save, remove } = useHomebrew(kind.collection, kind.recordSchema);
  // `"new"` while adding a row, a row's id while editing it.
  const [editing, setEditing] = useState<string>();
  const [deleting, setDeleting] = useState<HomebrewRow>();
  const [justDeleted, setJustDeleted] = useState<HomebrewRow>();
  const { undoOf, restore, resetRevert } = useHomebrewHistory();
  const selection = useContext(ExportSelection);
  const id = useId();
  const rows = list.data ?? [];
  const edited = rows.find((row) => row.id === editing);

  const opener = useRef<HTMLElement | null>(null);

  const openEditor = (next: string | undefined) => {
    if (next !== undefined && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
    save.reset();
    resetRevert();
    setEditing(next);
  };

  // Runs after the editor unmounts with focus inside it, which would leave focus on the body.
  useEffect(() => {
    if (editing === undefined && opener.current?.isConnected) opener.current.focus();
  }, [editing]);
  const closeDelete = () => {
    remove.reset();
    setDeleting(undefined);
  };

  return (
    <section aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-2.5">
      <h2 id={`${id}-title`} className="sr-only">
        {kind.heading}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <ImportHomebrew />
        <ExportHomebrew />
        <button
          type="button"
          onClick={() => openEditor("new")}
          className="ml-auto flex items-center gap-1 rounded-control border border-accent px-3 py-1.5 font-semibold text-accent-text text-row hover:bg-subtle"
        >
          <Plus aria-hidden="true" size={12} strokeWidth={2.5} />
          Add {kind.noun}
        </button>
      </div>
      {list.isPending && <LoadingState label={`Loading homebrew ${kind.heading.toLowerCase()}…`} />}
      {list.isError && <ErrorState error={list.error} />}
      {list.isSuccess && rows.length === 0 && (
        <EmptyState>No homebrew {kind.heading.toLowerCase()} yet.</EmptyState>
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <ListRow
              key={row.id}
              name={row.name}
              source={undefined}
              chips={
                <>
                  {row.edition && <EditionTag edition={row.edition} of={kind.noun} />}
                  {kind.chips(row).map((chip, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: two chips can share a label, and the list is redrawn whole.
                    <Tag key={index}>{chip}</Tag>
                  ))}
                </>
              }
              preview={firstLine(row.json.entries)}
              detail={{
                footer: (
                  <button
                    type="button"
                    aria-label={`Edit ${row.name}`}
                    onClick={() => openEditor(row.id)}
                    className="rounded-control border border-border bg-surface px-3.5 py-2 font-semibold text-ink text-row hover:bg-subtle"
                  >
                    Edit
                  </button>
                ),
                children:
                  row.json.entries && row.json.entries.length > 0 ? (
                    <RulesEntries entries={row.json.entries} />
                  ) : (
                    <p className="text-muted">No description.</p>
                  ),
              }}
              remove={
                <button
                  type="button"
                  aria-label={`Delete ${row.name}`}
                  title="Delete"
                  onClick={() => setDeleting(row)}
                  className="relative flex size-4.5 shrink-0 items-center justify-center text-muted before:absolute before:-inset-1 hover:text-ink"
                >
                  <X aria-hidden="true" size={12} />
                </button>
              }
              select={
                selection && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name} for export`}
                    checked={selection.isChosen({ collection: kind.collection, id: row.id })}
                    onChange={() => selection.toggle({ collection: kind.collection, id: row.id })}
                    className="size-4"
                  />
                )
              }
            />
          ))}
        </ul>
      )}
      {(editing === "new" || edited) && (
        <HomebrewEditor
          key={editing}
          collection={kind.collection}
          record={edited}
          saving={save.isPending}
          failure={save.error}
          undo={undoOf(kind.collection, edited?.id ?? "", () => setEditing(undefined))}
          onSave={(input) =>
            save.mutate({ id: edited?.id, input }, { onSuccess: () => setEditing(undefined) })
          }
          onClose={() => openEditor(undefined)}
        />
      )}
      {deleting && (
        <DeleteHomebrewDialog
          name={deleting.name}
          noun={kind.noun}
          deleting={remove.isPending}
          error={remove.error}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                const chosen = { collection: kind.collection, id: deleting.id };
                if (selection?.isChosen(chosen)) selection.toggle(chosen);
                setJustDeleted(deleting);
                restore.reset();
                closeDelete();
              },
            })
          }
          onClose={closeDelete}
        />
      )}
      {justDeleted && (
        <DeletedToast
          name={justDeleted.name}
          restoring={restore.isPending}
          failure={restore.error?.message}
          onUndo={() =>
            restore.mutate(
              { collection: kind.collection, id: justDeleted.id },
              { onSuccess: () => setJustDeleted(undefined) },
            )
          }
          onDismiss={() => setJustDeleted(undefined)}
        />
      )}
    </section>
  );
}
