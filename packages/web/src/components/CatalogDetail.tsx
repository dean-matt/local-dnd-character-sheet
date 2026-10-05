import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "../EmptyState.tsx";
import { ErrorState } from "../ErrorState.tsx";
import { useCatalogRow } from "../hooks/useCatalogRow.ts";
import { LoadingState } from "../LoadingState.tsx";
import { ApiError } from "../lib/api.ts";
import { matchCatalogTarget } from "../lib/catalogRows.ts";
import { Modal } from "./Modal.tsx";
import { RulesEntries } from "./RulesEntries/RulesEntries.tsx";
import { ResolvedRefs } from "./resolvedRefsContext.ts";
import { SourceChip } from "./SourceChip.tsx";
import { TypeChip } from "./TypeChip.tsx";

export interface CatalogDetailProps {
  /** A detail address such as `/spells/Fireball/PHB`, as `catalogRows.ts` names a row. */
  address: string;
  onClose: () => void;
}

const capitalized = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

/**
 * One catalog or homebrew row in a modal over the page that asked for it. The modal mounts
 * on `document.body`, since a reference that opens it sits inside a paragraph of rules text.
 */
export function CatalogDetail({ address, onClose }: CatalogDetailProps) {
  const match = matchCatalogTarget(address);
  const row = useCatalogRow(match);
  const modal = (title: string, body: ReactNode, badge?: ReactNode, meta?: ReactNode) =>
    createPortal(
      <Modal title={title} badge={badge} meta={meta} onClose={onClose}>
        {body}
      </Modal>,
      document.body,
    );

  if (!match || (row.error instanceof ApiError && row.error.status === 404)) {
    const lookedFor = match ? match.target.lookedFor(match.key) : address;
    return modal("Not found", <p className="text-muted">Nothing answers to {lookedFor}.</p>);
  }
  if (row.isError) return modal("Could not load", <ErrorState message={row.error.message} />);
  if (row.isPending) return modal("Loading…", <LoadingState />);

  const { name, source, edition, entries } = row.data;
  return modal(
    name,
    entries.length > 0 ? (
      // A block of its own: the map of the sheet that opened it holds none of this row's references.
      <ResolvedRefs value={null}>
        <RulesEntries entries={entries} headingLevel={3} />
      </ResolvedRefs>
    ) : (
      <EmptyState>This row carries no rules text of its own.</EmptyState>
    ),
    <TypeChip type={match.target.label}>{capitalized(match.target.label)}</TypeChip>,
    <SourceChip source={source} edition={edition} of={match.target.label} />,
  );
}
