import { createPortal } from "react-dom";
import { CatalogEntry } from "./CatalogEntry.tsx";
import { Modal } from "./Modal.tsx";

export interface CatalogDetailProps {
  /** A detail address such as `/spells/Fireball/PHB`, as `catalogRows.ts` names a row. */
  address: string;
  onClose: () => void;
}

/**
 * One catalog or homebrew row in a modal over the page that asked for it. The modal mounts
 * on `document.body`, since a reference that opens it sits inside a paragraph of rules text.
 */
export function CatalogDetail({ address, onClose }: CatalogDetailProps) {
  return createPortal(
    <Modal onClose={onClose}>
      <CatalogEntry address={address} />
    </Modal>,
    document.body,
  );
}
