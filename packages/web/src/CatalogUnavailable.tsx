import { StateCard } from "./StateCard.tsx";

/** A widget's place while `CatalogOutOfDateBanner` names the rebuild. */
export function CatalogUnavailable() {
  return (
    <StateCard>
      <p>Unavailable until the catalog is rebuilt.</p>
    </StateCard>
  );
}
