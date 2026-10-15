import type { SheetItem } from "@dnd/catalog";
import { Backpack, Hand, type LucideIcon, Shield, Shirt, Sword } from "lucide-react";
import { Popover } from "../../../../Popover.tsx";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

function equippedIcon(item: ResolvedItem): LucideIcon {
  if (item.weapon) return Sword;
  if (item.armor) return item.armor.category === "shield" ? Shield : Shirt;
  return Hand;
}

const BOX = "relative flex size-4.5 shrink-0 items-center justify-center rounded-chip border";

/**
 * A backpack while the item is stowed, its type's icon on accent red while equipped.
 * `requires` names the proficiency a stowed item lacks where the table refuses the equip:
 * the backpack greys out and opens a popover naming it in place of equipping.
 */
export function EquipToggle({
  item,
  requires,
  onChange,
  busy,
}: {
  item: ResolvedItem;
  requires?: string;
  onChange: (equipped: boolean) => void;
  busy: boolean;
}) {
  if (requires && !item.equipped) {
    return (
      <Popover
        trigger={
          <span
            className={`${BOX} cursor-not-allowed border-border bg-surface text-muted opacity-60`}
          >
            <Backpack aria-hidden="true" size={12} />
          </span>
        }
        triggerLabel={`Equip ${item.name}, unavailable`}
        label="Can't equip"
      >
        Requires {requires} proficiency.
      </Popover>
    );
  }
  const Icon = item.equipped ? equippedIcon(item) : Backpack;
  return (
    <button
      type="button"
      aria-label={`Equipped, ${item.name}`}
      aria-pressed={item.equipped}
      aria-disabled={busy || undefined}
      title={item.equipped ? "Equipped, click to stow" : "Stowed, click to equip"}
      onClick={() => onChange(!item.equipped)}
      className={`${BOX} before:absolute before:-inset-1 ${
        item.equipped ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"
      }`}
    >
      <Icon aria-hidden="true" size={12} />
    </button>
  );
}
