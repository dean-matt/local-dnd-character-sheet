import type { SheetItem } from "@dnd/catalog";
import { Tag } from "../../../Tag.tsx";

export function ItemMarks({ item }: { item: SheetItem }) {
  return (
    <>
      {item.equipped && <Tag>Equipped</Tag>}
      {item.attuned && <Tag>Attuned</Tag>}
      {!item.carried && <Tag>Not carried</Tag>}
    </>
  );
}
