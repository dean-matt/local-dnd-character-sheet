import type { SheetItem } from "@dnd/catalog";
import { renamedAt } from "../../../../lib/renamed.ts";
import { ListRow } from "../../../ListRow/ListRow.tsx";
import { NotFoundTag } from "../../../NotFoundTag.tsx";
import { ItemMarks } from "./ItemMarks.tsx";
import { RemoveItemButton } from "./RemoveItemButton.tsx";

/** `index` is the item's place in the definition, which names its field in the report. */
export function UnresolvedItemRow({
  item,
  index,
  characterId,
  onRemove,
}: {
  item: Extract<SheetItem, { resolved: false }>;
  index: number;
  characterId: string;
  onRemove: () => void;
}) {
  const variant = item.variant ? `, as ${item.variant.name} (${item.variant.source})` : "";
  return (
    <ListRow
      name={`${item.name}${variant}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`}
      source={item.source}
      chips={
        <>
          <ItemMarks item={item} />
          <NotFoundTag
            characterId={characterId}
            homebrew={item.source === undefined}
            renamed={renamedAt(`inventory[${index}].ref`, `inventory[${index}].variant`)}
          />
        </>
      }
      remove={<RemoveItemButton name={item.name} onRemove={onRemove} />}
    />
  );
}
