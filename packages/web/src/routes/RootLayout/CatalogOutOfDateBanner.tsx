import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { isCatalogOutOfDate } from "../../lib/api.ts";

/** The message of any query in the cache now failing on an out-of-date catalog. */
function useCatalogOutOfDate(): string | undefined {
  const cache = useQueryClient().getQueryCache();
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () =>
      cache.findAll().find((query) => isCatalogOutOfDate(query.state.error))?.state.error?.message,
  );
}

/**
 * One banner for every catalog read refused while `content.db` predates its schema, in place
 * of the error each widget would show. The API's message marks the command in backticks.
 */
export function CatalogOutOfDateBanner() {
  const message = useCatalogOutOfDate();
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-b border-border bg-surface px-gutter py-2 text-row text-error print:hidden"
    >
      {message.split("`").map((part, i) =>
        // biome-ignore lint/suspicious/noArrayIndexKey: the split is fixed for one message
        i % 2 ? <code key={i}>{part}</code> : part,
      )}
    </div>
  );
}
