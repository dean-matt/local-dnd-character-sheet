import { useId } from "react";
import { EditionTag } from "../../components/EditionTag.tsx";
import { Tag } from "../../components/Tag.tsx";
import { EmptyState } from "../../EmptyState.tsx";
import { useHomebrewHistory } from "../../hooks/useHomebrewHistory.ts";
import { capitalize } from "../../lib/capitalize.ts";
import { LISTING_KINDS } from "../../lib/homebrewListing.ts";

/**
 * Every homebrew row deleted since the API started, newest first, each restorable under its
 * old id. A restore onto a name another row now holds is refused and says which.
 */
export function RecentlyDeleted() {
  const id = useId();
  const { history, restore } = useHomebrewHistory();
  const deleted = history.data?.deleted ?? [];
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4"
    >
      <h2
        id={`${id}-title`}
        className="font-semibold text-label text-muted uppercase tracking-label"
      >
        Recently deleted
      </h2>
      <p className="text-label text-muted">
        Rows deleted since the API last started. Restarting it clears this list.
      </p>
      {history.isSuccess && deleted.length === 0 && (
        <EmptyState>Nothing deleted since the API started.</EmptyState>
      )}
      {deleted.length > 0 && (
        <ul className="flex flex-col gap-2">
          {deleted.map(({ collection, id: rowId, name, edition }) => (
            <li
              key={`${collection}/${rowId}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-subtle px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate font-semibold">{name}</span>
              <Tag>{capitalize(LISTING_KINDS[collection].noun)}</Tag>
              <EditionTag edition={edition} of={LISTING_KINDS[collection].noun} />
              <button
                type="button"
                aria-label={`Restore ${name}`}
                aria-disabled={restore.isPending}
                onClick={() => !restore.isPending && restore.mutate({ collection, id: rowId })}
                className="ml-auto rounded-control border border-border bg-surface px-3 py-1 font-semibold text-ink text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="alert" className="text-error text-row">
        {restore.error && `Restore failed: ${restore.error.message}`}
      </p>
    </section>
  );
}
