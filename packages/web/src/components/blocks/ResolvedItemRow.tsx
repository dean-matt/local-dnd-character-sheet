import type { SheetItem } from "@dnd/catalog";
import type { Attack, Grip } from "../../lib/attack.ts";
import { firstLine } from "../../lib/rulesProse.ts";
import { AttackChips } from "../AttackChips.tsx";
import { ListRow } from "../ListRow.tsx";
import { RulesEntries } from "../RulesEntries.tsx";
import { Tag } from "../Tag.tsx";
import { capitalize } from "./capitalize.ts";
import { GripToggle } from "./GripToggle.tsx";
import { ItemMarks } from "./ItemMarks.tsx";
import { ItemTypeChips } from "./ItemTypeChips.tsx";
import { pounds } from "./pounds.ts";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

/** Upstream prices in copper; a price prints in the largest coin that divides it evenly. */
function price(copper: number): string {
  const [coin, per] = (
    [
      ["gp", 100],
      ["sp", 10],
    ] as const
  ).find(([, size]) => copper % size === 0) ?? ["cp", 1];
  return `${(copper / per).toLocaleString("en-US")} ${coin}`;
}

export function ResolvedItemRow({
  item,
  attack,
  onGrip,
  saving,
}: {
  item: ResolvedItem;
  attack: Attack | undefined;
  onGrip: (grip: Grip) => void;
  saving: boolean;
}) {
  const rarity = item.rarity && item.rarity !== "none" ? capitalize(item.rarity) : undefined;
  return (
    <ListRow
      name={item.name}
      chips={
        <>
          <ItemTypeChips item={item} attacks={attack !== undefined} />
          {item.quantity > 1 && <Tag>×{item.quantity}</Tag>}
          {rarity && <Tag>{rarity}</Tag>}
          {item.weight !== null && (
            <Tag>
              <span className="sr-only">Weight: </span>
              {pounds(item.weight * item.quantity)}
            </Tag>
          )}
          <ItemMarks item={item} />
        </>
      }
      price={item.value === null ? undefined : price(item.value * item.quantity)}
      preview={firstLine(item.entries)}
      actions={attack && <AttackChips name={item.name} attack={attack} />}
      controls={
        attack?.grip && (
          <GripToggle name={item.name} grip={attack.grip} onChange={onGrip} saving={saving} />
        )
      }
      detail={{
        meta: rarity ?? "Item",
        children:
          item.entries.length > 0 ? (
            <RulesEntries entries={item.entries} />
          ) : (
            <p className="text-muted">No description.</p>
          ),
      }}
    />
  );
}
