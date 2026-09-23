import { Navigate, useParams } from "react-router";
import { getCharacterPages, visiblePages } from "../pages.ts";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

export function CharacterRedirect() {
  const { id = "" } = useParams();
  const [first] = visiblePages(getCharacterPages(id));

  if (!first) return <NotFoundPanel />;
  return <Navigate to={`/characters/${id}/p/${first.slug}`} replace />;
}
