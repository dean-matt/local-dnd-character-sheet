import { isCatalogOutOfDate } from "./lib/api.ts";
import { StateCard } from "./StateCard.tsx";

/** Renders nothing for a catalog out of date, which `CatalogOutOfDateBanner` reports once for the page. */
export function ErrorState({ error, message }: { error?: Error; message?: string }) {
  if (isCatalogOutOfDate(error)) return null;
  return (
    <StateCard>
      <p role="alert" className="text-error">
        {message ?? error?.message ?? "Something went wrong."}
      </p>
    </StateCard>
  );
}
