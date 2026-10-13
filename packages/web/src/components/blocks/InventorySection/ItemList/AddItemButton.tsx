import type { CharacterRecord } from "@dnd/character";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useReturnFocus } from "../../../../hooks/useReturnFocus.ts";
import { FormField } from "../../../FormField.tsx";
import { Modal } from "../../../Modal.tsx";
import { ModalEntry } from "../../../ModalEntry.tsx";
import { Select } from "../../../Select.tsx";
import { AddItemField } from "./AddItemField.tsx";
import type { InventoryEntry } from "./editInventoryEntry.ts";
import { GROUP_KINDS, GROUPS, type Group } from "./itemGroups.ts";

const ALL = "All items";

/**
 * A column's Add item button, opening a modal that searches the catalog for that column's
 * items. The column is a starting filter the player may widen to every item; what is added
 * lands in the column its own type belongs to. Adding closes the modal, and focus returns
 * to the button.
 */
export function AddItemButton({
  group,
  edition,
  onAdd,
}: {
  group: Group;
  edition: CharacterRecord["edition"];
  onAdd: (entry: Pick<InventoryEntry, "ref" | "variant" | "variantOverride">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Group | typeof ALL>(group);
  const trigger = useReturnFocus<HTMLButtonElement>(open);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-label={`Add item to ${group}`}
        onClick={() => {
          setShown(group);
          setOpen(true);
        }}
        className="flex cursor-pointer items-center gap-0.5 rounded-control p-1 font-semibold text-accent-text normal-case tracking-normal hover:bg-subtle"
      >
        <Plus aria-hidden="true" size={12} />
        Add item
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <ModalEntry title="Add an item">
            <FormField label="Show">
              {(control) => (
                <Select
                  {...control}
                  options={[...GROUPS, ALL].map((value) => ({ value, label: value }))}
                  value={shown}
                  onChange={(next) => setShown(next as Group | typeof ALL)}
                />
              )}
            </FormField>
            <AddItemField
              edition={edition}
              filters={shown === ALL ? undefined : { kind: GROUP_KINDS[shown] }}
              onAdd={(entry) => {
                onAdd(entry);
                setOpen(false);
              }}
            />
          </ModalEntry>
        </Modal>
      )}
    </>
  );
}
