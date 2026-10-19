import type { SheetItem } from "@dnd/catalog";
import { renamedAt } from "../../../../lib/renamed.ts";
import { shownName } from "../../../../lib/shownName.ts";
import { ListRow } from "../../../ListRow/ListRow.tsx";
import { NotFoundTag } from "../../../NotFoundTag.tsx";
import { RemoveButton } from "../../../RemoveButton.tsx";
import { ItemMarks } from "./ItemMarks.tsx";

/**
 * `index` is the item's place in the definition, which names its field in the report. `busy`
 * marks Remove disabled while the list drops clicks.
 */
export function UnresolvedItemRow({
  item,
  index,
  characterId,
  busy,
  onRemove,
}: {
  item: Extract<SheetItem, { resolved: false }>;
  index: number;
  characterId: string;
  busy: boolean;
  onRemove: () => void;
}) {
  const variant = item.variant
    ? `, as ${shownName(item.variant.name)} (${item.variant.source})`
    : "";
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
      remove={<RemoveButton name={item.name} onRemove={onRemove} busy={busy} />}
    />
  );
}
