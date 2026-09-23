import { useParams } from "react-router";
import { findCharacterPage } from "../pages.ts";
import { EmptyState } from "../states.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

export function CharacterPage() {
  const { id = "", slug = "" } = useParams();
  const page = findCharacterPage(id, slug);

  if (!page) return <NotFoundPanel />;

  return (
    <section>
      <h1 className="font-semibold text-2xl">{page.title}</h1>
      <div className="mt-4">
        <EmptyState>This page doesn't have content yet.</EmptyState>
      </div>
    </section>
  );
}
