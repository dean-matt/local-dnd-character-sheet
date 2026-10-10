import type { SheetItem } from "@dnd/catalog";
import type { ReactNode } from "react";
import { firstLine } from "../../../../../lib/rulesProse.ts";
import { ListRow } from "../../../../ListRow/ListRow.tsx";
import { RulesEntries } from "../../../../RulesEntries/RulesEntries.tsx";
import { Tag } from "../../../../Tag.tsx";
import type { Attack, Grip } from "../../../attack.ts";
import { capitalize } from "../../../capitalize.ts";
import { pounds } from "../../pounds.ts";
import { RemoveItemButton } from "../RemoveItemButton.tsx";
import { AttackChips } from "./AttackChips/AttackChips.tsx";
import { AttuneToggle } from "./AttuneToggle.tsx";
import { EquipToggle } from "./EquipToggle.tsx";
import { GripToggle } from "./GripToggle.tsx";
import { ItemTypeChips } from "./ItemTypeChips.tsx";
import { itemPrice } from "./itemPrice.ts";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

/**
 * `quantity` is the control that edits the count. `attuneRefusal` says why no slot is free,
 * and is `undefined` where one is.
 */
export function ResolvedItemRow({
  item,
  attack,
  quantity,
  attuneRefusal,
  onGrip,
  onEquip,
  onAttune,
  onRemove,
}: {
  item: ResolvedItem;
  attack: Attack | undefined;
  quantity: ReactNode;
  attuneRefusal: string | undefined;
  onGrip: (grip: Grip) => void;
  onEquip: (equipped: boolean) => void;
  onAttune: (attuned: boolean) => void;
  onRemove: () => void;
}) {
  const cost = itemPrice(item);
  const rarity = item.rarity && item.rarity !== "none" ? capitalize(item.rarity) : undefined;
  return (
    <ListRow
      name={item.name}
      source={item.source}
      chips={
        <>
          <ItemTypeChips item={item} attacks={attack !== undefined} />
          {rarity && <Tag>{rarity}</Tag>}
          {item.weight !== null && (
            <Tag>
              <span className="sr-only">Weight: </span>
              {pounds(item.weight * item.quantity)}
            </Tag>
          )}
          {item.overridden && <Tag>Off the rules</Tag>}
          {!item.carried && <Tag>Not carried</Tag>}
        </>
      }
      remove={<RemoveItemButton name={item.name} onRemove={onRemove} />}
      price={cost?.text}
      priceNote={cost?.note}
      preview={item.overridden ?? firstLine(item.entries)}
      actions={attack && <AttackChips name={item.name} attack={attack} />}
      controls={
        <>
          {attack?.grip && <GripToggle name={item.name} grip={attack.grip} onChange={onGrip} />}
          {(item.requiresAttunement || item.attuned) && (
            <AttuneToggle
              name={item.name}
              attuned={item.attuned}
              refusal={attuneRefusal}
              onChange={onAttune}
            />
          )}
          {quantity}
          <EquipToggle item={item} onChange={onEquip} />
        </>
      }
      detail={{
        meta: rarity ?? "Item",
        children: (
          <>
            {item.entries.length > 0 ? (
              <RulesEntries entries={item.entries} />
            ) : (
              <p className="text-muted">No description.</p>
            )}
            {cost?.note && <p className="text-muted">{cost.note}.</p>}
          </>
        ),
      }}
    />
  );
}
