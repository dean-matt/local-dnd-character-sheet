import { useParams } from "react-router";
import { Field } from "../components/Field.tsx";
import { useCharacter } from "../hooks/useCharacters.ts";
import { findCharacterPage } from "../pages.ts";
import { EmptyState, ErrorState, LoadingState } from "../states.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

/**
 * The read state of the field contract's worked example. `data.name` is a plain
 * field with no `field_overrides` row — it never routes through `rules`, so it
 * has no computed half to override — but `Field` only takes a `Derived<T>`, so
 * `manual` is hardcoded `null` here to demonstrate the read contract on the
 * simplest value available. The edit half is exercised by
 * `components/Field.test.tsx` — no view turns it on until editing ships in M5.
 */
export function CharacterPage() {
  const { id = "", slug = "" } = useParams();
  const page = findCharacterPage(id, slug);
  const { data, isPending, isError, error } = useCharacter(id);

  if (!page) return <NotFoundPanel />;

  return (
    <section>
      <h1 className="font-semibold text-2xl">{page.title}</h1>
      <div className="mt-4 flex flex-col gap-4">
        {isPending && <LoadingState label="Loading character…" />}
        {isError && <ErrorState message={error.message} />}
        {data && (
          <Field
            mode="read"
            label="Name"
            value={{ computed: data.name, manual: null }}
            format={(name) => name}
          />
        )}
        <EmptyState>This page doesn't have content yet.</EmptyState>
      </div>
    </section>
  );
}
