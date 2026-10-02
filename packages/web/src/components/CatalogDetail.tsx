import { useQuery } from "@tanstack/react-query";
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
    queryFn: () => {
      if (!match) throw new ApiError("No catalog row at that address", 404);
      return match.target.load(match.key);
    },
    retry: retryUnlessClientError,
  });
  const missing = !match || (row.error instanceof ApiError && row.error.status === 404);

  if (row.isPending) {
    return createPortal(
      <Modal title="Loading…" width="w-140" onClose={onClose}>
        <LoadingState />
      </Modal>,
      document.body,
    );
  }
  if (row.isError) {
    return createPortal(
      <Modal title={missing ? "Not found" : "Could not load"} width="w-140" onClose={onClose}>
        {missing ? (
          <p className="text-muted">
            Nothing answers to {match ? match.target.lookedFor(match.key) : address}.
          </p>
        ) : (
          <ErrorState message={row.error.message} />
        )}
      </Modal>,
      document.body,
    );
  }

  const { name, source, edition, entries } = row.data;
  return createPortal(
    <Modal
      title={name}
      badge={match && <Tag>{capitalized(match.target.label)}</Tag>}
      meta={
        <span className="flex items-center gap-1.5">
          <Tag>{source ?? "Homebrew"}</Tag>
          {edition && <EditionTag edition={edition} of="row" />}
        </span>
      }
      width="w-140"
      onClose={onClose}
    >
      {entries.length > 0 ? (
        <RulesEntries entries={entries} headingLevel={3} />
      ) : (
        <EmptyState>This row carries no rules text of its own.</EmptyState>
      )}
    </Modal>,
    document.body,
  );
}
