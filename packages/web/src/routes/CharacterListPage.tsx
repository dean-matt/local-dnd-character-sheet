import { EmptyState } from "../states.tsx";

export function CharacterListPage() {
  return (
    <section>
      <h1 className="font-semibold text-2xl">local-dnd-character-sheet</h1>
      <div className="mt-4">
        <EmptyState>No characters yet.</EmptyState>
      </div>
    </section>
  );
}
