import { useParams } from "react-router";
import { EmptyState } from "../states.tsx";

export function CatalogPage() {
  const { "*": path = "" } = useParams();

  return (
    <section>
      <h1 className="font-semibold text-2xl">Catalog</h1>
      <div className="mt-4">
        <EmptyState>{path ? `Nothing renders "${path}" yet.` : "Nothing to show yet."}</EmptyState>
      </div>
    </section>
  );
}
