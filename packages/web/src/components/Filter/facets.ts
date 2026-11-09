import { useState } from "react";

export type Facet<Row> = {
  key: string;
  label: string;
  /** The values a row holds for the facet; a row holding none never matches a pick. */
  valuesOf: (row: Row) => readonly string[];
};

/** A row matches where, for every facet with picks, it holds any one of them. */
export function matchesFacets<Row>(
  row: Row,
  facets: readonly Facet<Row>[],
  picks: Record<string, string[]>,
): boolean {
  return facets.every(({ key, valuesOf }) => {
    const chosen = picks[key] ?? [];
    return chosen.length === 0 || valuesOf(row).some((value) => chosen.includes(value));
  });
}

/** The picks per facet key, held in the view and never stored. */
export function useFacetPicks() {
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  return {
    picks,
    active: Object.values(picks).filter((chosen) => chosen.length > 0).length,
    set: (key: string, next: string[]) => setPicks((at) => ({ ...at, [key]: next })),
    reset: () => setPicks({}),
  };
}
