import {
  LIST_BLOCK_SOURCES,
  type PageBlock,
  SHEET_SECTIONS,
  VALUE_BLOCK_FIELDS,
} from "@dnd/character";
import { Plus } from "lucide-react";
import { useId } from "react";
import { Modal } from "../../components/Modal.tsx";
import { ModalEntry } from "../../components/ModalEntry.tsx";
import { blockLabel, SECTION_LABELS, SOURCE_LABELS, VALUE_LABELS } from "../../lib/blockLabels.ts";

const GROUPS: { heading: string; blocks: { label: string; block: PageBlock }[] }[] = [
  {
    heading: "Whole section",
    blocks: SHEET_SECTIONS.map((section) => ({
      label: SECTION_LABELS[section],
      block: { kind: "section", section },
    })),
  },
  {
    heading: "One value",
    blocks: VALUE_BLOCK_FIELDS.map((field) => ({
      label: VALUE_LABELS[field],
      block: { kind: "value", field },
    })),
  },
  {
    heading: "Filtered list",
    blocks: LIST_BLOCK_SOURCES.map((source) => ({
      label: SOURCE_LABELS[source],
      block: { kind: "list", source, filter: {} },
    })),
  },
  { heading: "Your own text", blocks: [{ label: "Text", block: { kind: "text", text: "" } }] },
];

/** Every block kind a page can hold, grouped by kind; choosing one adds it and closes. */
export function BlockPicker({
  onAdd,
  onClose,
}: {
  onAdd: (block: PageBlock) => void;
  onClose: () => void;
}) {
  const id = useId();
  return (
    <Modal onClose={onClose}>
      <ModalEntry title="Add a block">
        {GROUPS.map(({ heading, blocks }, index) => (
          <section key={heading} aria-labelledby={`${id}-${index}`} className="flex flex-col gap-1">
            <h3 id={`${id}-${index}`} className="font-semibold text-muted text-row">
              {heading}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {blocks.map(({ label, block }) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-label={`Add ${blockLabel(block)}`}
                    onClick={() => onAdd(block)}
                    className="flex items-center gap-1 rounded-control border border-border px-2.5 py-1 text-ink text-row hover:bg-subtle"
                  >
                    <Plus aria-hidden="true" size={12} />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </ModalEntry>
    </Modal>
  );
}
