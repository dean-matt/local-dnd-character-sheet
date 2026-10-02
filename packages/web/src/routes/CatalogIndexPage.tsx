import { Link, useSearchParams } from "react-router";
import { EmptyState } from "../EmptyState.tsx";
import { ErrorState } from "../ErrorState.tsx";
import { useCatalogIndex } from "../hooks/useCatalogIndex.ts";
import { LoadingState } from "../LoadingState.tsx";
import type { CatalogIndex } from "../lib/catalogIndexes.ts";
import { EDITION_LABELS } from "../lib/editionLabels.ts";
import { CatalogIndexPager } from "./CatalogIndexPager.tsx";
import { CatalogIndexRows } from "./CatalogIndexRows.tsx";

const PAGE_SIZE = 100;
const EDITIONS = ["one", "classic"] as const;

/**
 * Every row of one catalog type, a page of one edition at a time. The edition and the page
 * live in the URL, so a reload or a back button returns to the same page.
 */
export function CatalogIndexPage({ index }: { index: CatalogIndex }) {
  const [params] = useSearchParams();
  const edition = params.get("edition") === "classic" ? "classic" : "one";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const list = useCatalogIndex(index, edition, (page - 1) * PAGE_SIZE, PAGE_SIZE);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;
  const at = (to: { edition?: string; page?: number }) =>
    `?${new URLSearchParams({ edition: to.edition ?? edition, page: String(to.page ?? 1) })}`;

  return (
    <section aria-labelledby="catalog-index">
      <h1 id="catalog-index" className="font-semibold text-2xl">
        {index.label}
      </h1>
      <nav aria-label="Edition" className="mt-2 flex gap-2 text-row">
        {EDITIONS.map((option) => (
          <Link
            key={option}
            to={at({ edition: option })}
            aria-current={option === edition ? "page" : undefined}
            className={`rounded-control px-2 py-1 ${option === edition ? "bg-accent-tint font-bold text-accent-text" : "text-secondary hover:bg-subtle"}`}
          >
            {EDITION_LABELS[option]}
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        {list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState message={list.error.message} />
        ) : list.data.total === 0 ? (
          <EmptyState>No {index.label.toLowerCase()} in this edition.</EmptyState>
        ) : list.data.items.length === 0 ? (
          <EmptyState>
            This list ends at page {pages}.{" "}
            <Link to={at({ page: pages })}>Go to the last page</Link>
          </EmptyState>
        ) : (
          <CatalogIndexRows collection={index.collection} rows={list.data.items} />
        )}
      </div>
      <CatalogIndexPager page={page} pages={pages} href={(to) => at({ page: to })} />
    </section>
  );
}
