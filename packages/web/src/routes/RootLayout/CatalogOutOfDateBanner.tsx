import { useCatalogOutOfDate } from "../../hooks/useCatalogOutOfDate.ts";

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
