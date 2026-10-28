/** A catalog row keyed `(name, source)` or a homebrew row keyed by `id`. */
type NamedRow = { name: string } & ({ id: string } | { source: string });

/**
 * Labels each of `rows` by its name, with its source or `homebrew` beside it where
 * another row shares the name: `Fighter (PHB)` beside `Fighter (homebrew)`.
 */
export function sharedNameLabel(rows: readonly NamedRow[]): (row: NamedRow) => string {
  const names = rows.map((row) => row.name);
  const shared = new Set(names.filter((name, index) => names.indexOf(name) !== index));
  return (row) =>
    shared.has(row.name) ? `${row.name} (${"id" in row ? "homebrew" : row.source})` : row.name;
}
