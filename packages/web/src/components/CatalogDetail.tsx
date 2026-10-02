import { skipToken, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "../EmptyState.tsx";
import { ErrorState } from "../ErrorState.tsx";
import { LoadingState } from "../LoadingState.tsx";
import { ApiError } from "../lib/api.ts";
import { matchCatalogTarget } from "../lib/catalogRows.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";
import { EditionTag } from "./EditionTag.tsx";
import { Modal } from "./Modal.tsx";
import { RulesEntries } from "./RulesEntries/RulesEntries.tsx";
import { Tag } from "./Tag.tsx";

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
  const row = useQuery({
    queryKey: ["catalog", address],
    queryFn: match ? () => match.target.load(match.key) : skipToken,
    retry: retryUnlessClientError,
  });
  const modal = (title: string, body: ReactNode, badge?: ReactNode, meta?: ReactNode) =>
    createPortal(
      <Modal title={title} badge={badge} meta={meta} width="w-140" onClose={onClose}>
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
      <RulesEntries entries={entries} headingLevel={3} />
    ) : (
      <EmptyState>This row carries no rules text of its own.</EmptyState>
    ),
    <Tag>{capitalized(match.target.label)}</Tag>,
    <span className="flex items-center gap-1.5">
      <Tag>{source ?? "Homebrew"}</Tag>
      {edition && <EditionTag edition={edition} of="row" />}
    </span>,
  );
}
