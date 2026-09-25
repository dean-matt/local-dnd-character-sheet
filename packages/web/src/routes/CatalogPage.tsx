import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { RulesEntries } from "../components/RulesText.tsx";
import { Tag } from "../components/Tag.tsx";
import { ApiError, retryUnlessClientError } from "../lib/api.ts";
import type { CatalogTarget } from "../lib/catalogRows.ts";
import { EmptyState, ErrorState, LoadingState } from "../states.tsx";
import { NotFoundPanel } from "./NotFoundPanel.tsx";

/** One catalog or homebrew row, read by the identity key its address carries. */
export function CatalogPage({ target }: { target: CatalogTarget }) {
  const key = useParams();
  const row = useQuery({
    queryKey: ["catalog", target.path, key],
    queryFn: () => target.load(key),
    retry: retryUnlessClientError,
  });

  if (row.isPending) return <LoadingState />;
  if (row.isError) {
    return row.error instanceof ApiError && row.error.status === 404 ? (
      <NotFoundPanel lookedFor={target.lookedFor(key)} />
    ) : (
      <ErrorState message={row.error.message} />
    );
  }

  const { name, source, entries } = row.data;
  return (
    <article>
      <h1 className="font-semibold text-2xl">{name}</h1>
      <p className="mt-1 text-muted text-row">{source ?? <Tag>Homebrew</Tag>}</p>
      <div className="mt-4 flex flex-col gap-2">
        {entries.length > 0 ? (
          <RulesEntries entries={entries} headingLevel={2} />
        ) : (
          <EmptyState>This row carries no rules text of its own.</EmptyState>
        )}
      </div>
    </article>
  );
}
