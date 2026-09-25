/**
 * The Inventory page: what the character carries against what they can, the attunement
 * slots in use, their coins, then every item. The load comes off the derived block and
 * every item off `/characters/{id}/inventory`, so this file does no rules arithmetic of
 * its own.
 */
import type { SheetItem } from "@dnd/catalog";
import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { type ReactNode, useId, useState } from "react";
import { useCharacterInventory } from "../../hooks/useCharacterInventory.ts";
import { EmptyState, ErrorState, LoadingState } from "../../states.tsx";
import { Card } from "../Card.tsx";
import { Field } from "../Field.tsx";
import { RulesEntries } from "../RulesText.tsx";
import { Tag } from "../Tag.tsx";

const pounds = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} lb`;

const ENCUMBRANCE_LABEL: Record<NonNullable<CharacterDerived["encumbrance"]>, string> = {
  unencumbered: "Unencumbered",
  encumbered: "Encumbered",
  heavilyEncumbered: "Heavily encumbered",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted text-row">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

/** A carried item nothing resolves weighs nothing in the total, so the card says so. */
function Load({ character, derived }: { character: CharacterRecord; derived: CharacterDerived }) {
  const inventory = useCharacterInventory(character.id);
  const missing =
    inventory.data?.items.filter((item) => !item.resolved && item.carried).length ?? 0;
  return (
    <Card title="Carrying">
      <div className="flex flex-col gap-1">
        <Row label="Carried">{pounds(derived.carriedWeight)}</Row>
        <Field
          mode="read"
          label="Carrying Capacity"
          value={derived.carryingCapacity}
          format={pounds}
        />
        {derived.encumbrance && (
          <Row label="Encumbrance">{ENCUMBRANCE_LABEL[derived.encumbrance]}</Row>
        )}
        {missing > 0 && (
          <p className="text-muted text-row">
            Leaves out {missing === 1 ? "1 item" : `${missing} items`} not found.
          </p>
        )}
      </div>
    </Card>
  );
}

function Attunement({
  definition,
  derived,
}: {
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  const used = definition.inventory.filter((entry) => entry.attuned).length;
  return (
    <Card title="Attunement">
      <div className="flex flex-col gap-1">
        <Row label="Attuned">{used}</Row>
        <Field mode="read" label="Slots" value={derived.attunementSlots} format={String} />
      </div>
    </Card>
  );
}

const COINS = [
  ["platinum", "Platinum (pp)"],
  ["gold", "Gold (gp)"],
  ["electrum", "Electrum (ep)"],
  ["silver", "Silver (sp)"],
  ["copper", "Copper (cp)"],
] as const;

function Currency({ money }: { money: CharacterDefinition["money"] }) {
  return (
    <Card title="Currency">
      <div className="flex flex-col gap-1">
        {COINS.map(([coin, label]) => (
          <Row key={coin} label={label}>
            {money[coin].toLocaleString("en-US")}
          </Row>
        ))}
      </div>
    </Card>
  );
}

function Marks({ item }: { item: SheetItem }) {
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

const quantity = (item: SheetItem) => (item.quantity > 1 ? ` ×${item.quantity}` : "");

function UnresolvedRow({ item }: { item: Extract<SheetItem, { resolved: false }> }) {
  const source = item.source ? ` (${item.source})` : "";
  const variant = item.variant ? `, as ${item.variant.name} (${item.variant.source})` : "";
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
      <span>
        {item.name}
        {source}
        {variant}
        {quantity(item)}
      </span>
      <Marks item={item} />
      <span className="text-muted text-row">
        {item.source === undefined ? "Not found in homebrew" : "Not found in the catalog"}
      </span>
    </li>
  );
}

/** A button rather than a `<details>`, for the reason `SpellsSection` gives. */
function ResolvedRow({ item }: { item: Extract<SheetItem, { resolved: true }> }) {
  const [open, setOpen] = useState(false);
  const textId = useId();
  const rarity = item.rarity && item.rarity !== "none" ? item.rarity : undefined;
  return (
    <li className="py-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen(!open)}
          className="flex cursor-pointer items-baseline gap-2 font-medium"
        >
          <span aria-hidden="true" className={`text-muted ${open ? "rotate-90" : ""}`}>
            ▸
          </span>
          {item.name}
        </button>
        {item.quantity > 1 && <span className="text-muted text-row">×{item.quantity}</span>}
        {rarity && <span className="text-muted text-row">{rarity}</span>}
        <Marks item={item} />
        {item.weight !== null && (
          <span className="ml-auto text-muted text-row">
            <span className="sr-only">Weight: </span>
            {pounds(item.weight * item.quantity)}
          </span>
        )}
      </div>
      <div id={textId} hidden={!open} className="mt-2 flex flex-col gap-2 pl-4">
        {open &&
          (item.entries.length > 0 ? (
            <RulesEntries entries={item.entries} />
          ) : (
            <p className="text-muted text-row">No description.</p>
          ))}
      </div>
    </li>
  );
}

function ItemList({ character }: { character: CharacterRecord }) {
  const inventory = useCharacterInventory(character.id);
  if (inventory.isPending) return <LoadingState label="Loading inventory…" />;
  if (inventory.isError) return <ErrorState message={inventory.error.message} />;
  if (inventory.data.items.length === 0) {
    return <EmptyState>{character.name} has no items yet.</EmptyState>;
  }
  return (
    <Card title="Items">
      <ul className="divide-y divide-border">
        {inventory.data.items.map((item, index) =>
          item.resolved ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: two entries may hold the same item.
            <ResolvedRow key={index} item={item} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: two entries may hold the same item.
            <UnresolvedRow key={index} item={item} />
          ),
        )}
      </ul>
    </Card>
  );
}

export function InventorySection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character) return <EmptyState>Inventory isn't available yet.</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {derived && <Load character={character} derived={derived} />}
        {derived && <Attunement definition={character.definition} derived={derived} />}
        <Currency money={character.definition.money} />
      </div>
      <ItemList character={character} />
    </div>
  );
}
