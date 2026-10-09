import { Pencil, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { EditionTag } from "../../components/EditionTag.tsx";
import { ListRow } from "../../components/ListRow/ListRow.tsx";
import { RulesEntries } from "../../components/RulesEntries/RulesEntries.tsx";
import { Tag } from "../../components/Tag.tsx";
import { EmptyState } from "../../EmptyState.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useHomebrew } from "../../hooks/useHomebrew.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { firstLine } from "../../lib/rulesProse.ts";
import { DeleteHomebrewDialog } from "./DeleteHomebrewDialog.tsx";
import { HomebrewEditor } from "./HomebrewEditor.tsx";
import type { HomebrewKind, HomebrewRow } from "./homebrewKinds.ts";

const ICON_BUTTON =
  "flex size-6 items-center justify-center rounded-control text-muted hover:bg-border";

/** One kind of homebrew: its rows, each editable and deletable, and a way to add one. */
export function HomebrewSection({ kind }: { kind: HomebrewKind }) {
  const { list, save, remove } = useHomebrew(kind.collection, kind.recordSchema);
  // `"new"` while adding a row, a row's id while editing it.
  const [editing, setEditing] = useState<string>();
  const [deleting, setDeleting] = useState<HomebrewRow>();
  const id = useId();
  const rows = list.data ?? [];
  const edited = rows.find((row) => row.id === editing);

  const openEditor = (next: string | undefined) => {
    save.reset();
    setEditing(next);
  };
  const closeDelete = () => {
    remove.reset();
    setDeleting(undefined);
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id={`${id}-title`}
          className="font-semibold text-label text-muted uppercase tracking-label"
        >
          {kind.heading}
        </h2>
        <button
          type="button"
          onClick={() => openEditor("new")}
          className="flex items-center gap-1 rounded-control border border-accent px-3 py-1.5 font-semibold text-accent-text text-row hover:bg-subtle"
        >
          <Plus aria-hidden="true" size={12} strokeWidth={2.5} />
          Add {kind.noun}
        </button>
      </div>
      {list.isPending && <LoadingState label={`Loading homebrew ${kind.heading.toLowerCase()}…`} />}
      {list.isError && <ErrorState message={list.error.message} />}
      {list.isSuccess && rows.length === 0 && editing === undefined && (
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
                  <EditionTag edition={row.edition} of={kind.noun} />
                  {kind.chips(row).map((chip) => (
                    <Tag key={chip}>{chip}</Tag>
                  ))}
                </>
              }
              preview={firstLine(row.json.entries)}
              detail={
                row.json.entries && row.json.entries.length > 0
                  ? { children: <RulesEntries entries={row.json.entries} /> }
                  : undefined
              }
              controls={
                <>
                  <button
                    type="button"
                    aria-label={`Edit ${row.name}`}
                    onClick={() => openEditor(row.id)}
                    className={ICON_BUTTON}
                  >
                    <Pencil aria-hidden="true" size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${row.name}`}
                    onClick={() => setDeleting(row)}
                    className={ICON_BUTTON}
                  >
                    <X aria-hidden="true" size={12} />
                  </button>
                </>
              }
            />
          ))}
        </ul>
      )}
      {(editing === "new" || edited) && (
        <HomebrewEditor
          key={editing}
          kind={kind}
          record={edited}
          saving={save.isPending}
          failure={save.error?.message}
          onSave={(input) =>
            save.mutate({ id: edited?.id, input }, { onSuccess: () => setEditing(undefined) })
          }
          onCancel={() => openEditor(undefined)}
        />
      )}
      {deleting && (
        <DeleteHomebrewDialog
          name={deleting.name}
          noun={kind.noun}
          deleting={remove.isPending}
          error={remove.error}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: closeDelete })}
          onClose={closeDelete}
        />
      )}
    </section>
  );
}
