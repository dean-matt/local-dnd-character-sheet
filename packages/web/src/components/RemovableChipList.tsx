import { PILL } from "../lib/chipStyles.ts";
import { EmptyNote } from "./EmptyNote.tsx";
import { RemoveButton } from "./RemoveButton.tsx";

export interface RemovableChipListProps {
  /**
   * `key` is what `onRemove` receives, unique within the list. `name` is what × reads as
   * removing, where the label alone is ambiguous beside another list.
   */
  items: readonly { key: string; label: string; name?: string }[];
  onRemove: (key: string) => void;
  empty?: string;
}

/** `ChipList`'s row with × on each chip, for a list the player edits. */
export function RemovableChipList({ items, onRemove, empty }: RemovableChipListProps) {
  if (items.length === 0) return empty ? <EmptyNote>{empty}</EmptyNote> : null;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item) => (
        <li key={item.key} className={`${PILL} flex items-center gap-1 pr-1.5`}>
          {item.label}
          <RemoveButton
            name={item.name ?? item.label}
            onRemove={() => onRemove(item.key)}
            busy={false}
          />
        </li>
      ))}
    </ul>
  );
}
