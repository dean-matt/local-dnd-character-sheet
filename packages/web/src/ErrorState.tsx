import { CatalogUnavailable } from "./CatalogUnavailable.tsx";
import { isCatalogOutOfDate } from "./lib/api.ts";
import { StateCard } from "./StateCard.tsx";

/**
 * For a catalog out of date, a quiet placeholder rather than an alert: `CatalogOutOfDateBanner`
 * reports that once for the page.
 */
export function ErrorState({ error, message }: { error?: Error; message?: string }) {
  if (isCatalogOutOfDate(error)) return <CatalogUnavailable />;
  return (
    <StateCard>
      <p role="alert" className="text-error">
        {message ?? error?.message ?? "Something went wrong."}
      </p>
    </StateCard>
  );
}
