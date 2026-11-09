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

/** A bound as typed: empty is no bound. */
export type Range = { min: string; max: string };

export const NO_RANGE: Range = { min: "", max: "" };

/** A row's value matches where it sits within each bound set; a row with no value matches none. */
export function inRange(value: number | undefined, { min, max }: Range): boolean {
  if (min === "" && max === "") return true;
  if (value === undefined) return false;
  return (min === "" || value >= Number(min)) && (max === "" || value <= Number(max));
}
