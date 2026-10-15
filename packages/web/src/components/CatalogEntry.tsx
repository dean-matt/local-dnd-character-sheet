import { type ReactNode, useState } from "react";
import { EmptyState } from "../EmptyState.tsx";
import { ErrorState } from "../ErrorState.tsx";
import type { AddOutcome } from "../hooks/useAddToCharacter.ts";
import { useCatalogRow } from "../hooks/useCatalogRow.ts";
import { LoadingState } from "../LoadingState.tsx";
import { addableAt } from "../lib/addable.ts";
import { ApiError } from "../lib/api.ts";
import { matchCatalogTarget } from "../lib/catalogRows.ts";
import { AddedNotice } from "./AddedNotice.tsx";
import { AddTo } from "./AddTo/AddTo.tsx";
import { ModalEntry } from "./ModalEntry.tsx";
import { RulesEntries } from "./RulesEntries/RulesEntries.tsx";
import { ResolvedRefs } from "./resolvedRefsContext.ts";
import { SourceChip } from "./SourceChip.tsx";
import { TypeChip } from "./TypeChip.tsx";

const capitalized = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/**
 * One catalog or homebrew row as an entry of a `Modal`, fetched while it shows. An item, a
 * spell or a feat ends on "Add to…".
 */
export function CatalogEntry({ address }: { address: string }) {
  const match = matchCatalogTarget(address);
  const row = useCatalogRow(match);
  const [added, setAdded] = useState<AddOutcome>();
  const entry = (
    title: string,
    body: ReactNode,
    badge?: ReactNode,
    meta?: ReactNode,
    footer?: ReactNode,
  ) => (
    <ModalEntry title={title} badge={badge} meta={meta} footer={footer}>
      {body}
    </ModalEntry>
  );

  if (!match || (row.error instanceof ApiError && row.error.status === 404)) {
    const lookedFor = match ? match.target.lookedFor(match.key) : address;
    return entry("Not found", <p className="text-muted">Nothing answers to {lookedFor}.</p>);
  }
  if (row.isError) return entry("Could not load", <ErrorState error={row.error} />);
  if (row.isPending) return entry("Loading…", <LoadingState />);

  const { name, source, edition, qualifier, entries } = row.data;
  const label = match.target.label(match.key);
  const addable = addableAt(address, name, source);
  return entry(
    name,
    <>
      {addable && <AddedNotice outcome={added} />}
      {entries.length > 0 ? (
        // A block of its own: the map of the sheet that opened it holds none of this row's references.
        <ResolvedRefs value={null}>
          <RulesEntries entries={entries} headingLevel={3} />
        </ResolvedRefs>
      ) : (
        <EmptyState>This row carries no rules text of its own.</EmptyState>
      )}
    </>,
    <TypeChip type={label}>{capitalized(label)}</TypeChip>,
    <span className="flex items-center gap-2">
      {qualifier}
      <SourceChip source={source} edition={edition} of={label} />
    </span>,
    addable && <AddTo row={addable} onAdded={setAdded} look="primary" above />,
  );
}
