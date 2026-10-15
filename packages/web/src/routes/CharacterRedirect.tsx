import { Navigate, useParams } from "react-router";
import { ErrorState } from "../ErrorState.tsx";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { LoadingState } from "../LoadingState.tsx";

export function CharacterRedirect() {
  const { id = "" } = useParams();
  const { data, isPending, isError, error } = useCharacterPages(id);

  if (isPending) return <LoadingState label="Loading pages…" />;
  if (isError) return <ErrorState error={error} />;

  const first = data.find((page) => !page.hidden);
  if (!first) {
    return (
      <section>
        <h1 className="font-semibold text-2xl">No pages to show</h1>
        <p className="mt-2 text-muted text-row">
          Every page is hidden or deleted. Manage pages, in the sidebar, shows one again, adds a
          page or restores the defaults.
        </p>
      </section>
    );
  }
  return <Navigate to={`/characters/${id}/p/${first.slug}`} replace />;
}
