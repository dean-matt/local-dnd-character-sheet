import { Navigate, useParams } from "react-router";
import { ErrorState } from "../ErrorState.tsx";
import { useCharacterPages } from "../hooks/useCharacterPages.ts";
import { LoadingState } from "../LoadingState.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

export function CharacterRedirect() {
  const { id = "" } = useParams();
  const { data, isPending, isError, error } = useCharacterPages(id);

  if (isPending) return <LoadingState label="Loading pages…" />;
  if (isError) return <ErrorState error={error} />;

  const first = data.find((page) => !page.hidden);
  if (!first) return <NotFoundPanel />;
  return <Navigate to={`/characters/${id}/p/${first.slug}`} replace />;
}
