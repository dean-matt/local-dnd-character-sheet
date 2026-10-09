import type { SheetItem } from "@dnd/catalog";
import { Backpack, Hand, type LucideIcon, Shield, Shirt, Sword } from "lucide-react";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

function equippedIcon(item: ResolvedItem): LucideIcon {
  if (item.weapon) return Sword;
  if (item.armor) return item.armor.category === "shield" ? Shield : Shirt;
  return Hand;
}

/** A backpack while the item is stowed, its type's icon on accent red while equipped. */
export function EquipToggle({
  item,
  onChange,
}: {
  item: ResolvedItem;
  onChange: (equipped: boolean) => void;
}) {
  const Icon = item.equipped ? equippedIcon(item) : Backpack;
  return (
    <button
      type="button"
      aria-label={`Equipped, ${item.name}`}
      aria-pressed={item.equipped}
      title={item.equipped ? "Equipped, click to stow" : "Stowed, click to equip"}
      onClick={() => onChange(!item.equipped)}
      className={`relative flex size-4.5 shrink-0 items-center justify-center rounded-chip border before:absolute before:-inset-1 ${
        item.equipped ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"
      }`}
    >
      <Icon aria-hidden="true" size={12} />
    </button>
  );
}
