import type { SheetItem } from "@dnd/catalog";
import { Tag } from "../../../Tag.tsx";

export function ItemMarks({ item }: { item: SheetItem }) {
  return (
    <>
      {item.source === undefined && <Tag>Homebrew</Tag>}
      {item.equipped && <Tag>Equipped</Tag>}
      {item.attuned && <Tag>Attuned</Tag>}
      {item.resolved && item.requiresAttunement && !item.attuned && <Tag>Requires attunement</Tag>}
      {!item.carried && <Tag>Not carried</Tag>}
    </>
  );
}
