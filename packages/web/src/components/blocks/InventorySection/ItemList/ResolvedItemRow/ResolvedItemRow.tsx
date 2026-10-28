import type { SheetItem } from "@dnd/catalog";
import type { ReactNode } from "react";
import { capitalize } from "../../../../../lib/capitalize.ts";
import { firstLine } from "../../../../../lib/rulesProse.ts";
import { EditHomebrewButton } from "../../../../EditHomebrewButton.tsx";
import { ListRow } from "../../../../ListRow/ListRow.tsx";
import { RemoveButton } from "../../../../RemoveButton.tsx";
import { RulesEntries } from "../../../../RulesEntries/RulesEntries.tsx";
import { Tag } from "../../../../Tag.tsx";
import type { Attack, Grip } from "../../../attack.ts";
import { pounds } from "../../pounds.ts";
import { AttackChips } from "./AttackChips/AttackChips.tsx";
import { AttuneToggle } from "./AttuneToggle.tsx";
import { EquipToggle } from "./EquipToggle.tsx";
import { GripToggle } from "./GripToggle.tsx";
import { ItemTypeChips } from "./ItemTypeChips.tsx";
import { itemPrice } from "./itemPrice.ts";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

/**
 * `quantity` is the control that edits the count, `placement` the one that picks a container,
 * and `picks` the controls for what the wearer chooses on the item.
 * `busy` marks the row's toggles and Remove disabled while the list drops clicks.
 * `equipRequires` names the proficiency the table requires before the item equips.
 */
export function ResolvedItemRow({
  item,
  attack,
  quantity,
  placement,
  picks,
  busy,
  equipRequires,
  onGrip,
  onEquip,
  onAttune,
  onRemove,
}: {
  item: ResolvedItem;
  attack: Attack | undefined;
  quantity: ReactNode;
  placement: ReactNode;
  picks: ReactNode;
  busy: boolean;
  equipRequires?: string;
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
      remove={<RemoveButton name={item.name} onRemove={onRemove} busy={busy} />}
      price={cost?.text}
      priceNote={cost?.note}
      preview={item.overridden ?? firstLine(item.entries)}
      actions={attack && <AttackChips name={item.name} attack={attack} />}
      controls={
        <>
          {attack?.grip && (
            <GripToggle name={item.name} grip={attack.grip} onChange={onGrip} busy={busy} />
          )}
          {(item.requiresAttunement || item.attuned) && (
            <AttuneToggle name={item.name} attuned={item.attuned} onChange={onAttune} busy={busy} />
          )}
          {quantity}
          {placement}
          {picks}
          <EquipToggle item={item} requires={equipRequires} onChange={onEquip} busy={busy} />
        </>
      }
      detail={{
        meta: rarity ?? "Item",
        footer: item.homebrewId && <EditHomebrewButton collection="items" id={item.homebrewId} />,
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
