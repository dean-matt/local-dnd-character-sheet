/**
 * The Inventory page: what the character carries against what they can, the attunement
 * slots in use, their coins, then every item split into Weapons, Armor and Gear by its
 * type. The load and each weapon's attack come off the derived block and every item off
 * `/characters/{id}/inventory`, so this file does no rules arithmetic of its own. A
 * versatile weapon's grip is the one thing it writes, back into the definition.
 */
import type { SheetItem } from "@dnd/catalog";
import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import type { ReactNode } from "react";
import { useCharacterInventory } from "../../hooks/useCharacterInventory.ts";
import { useUpdateCharacterDefinition } from "../../hooks/useCharacters.ts";
import { EmptyState, ErrorState, LoadingState } from "../../states.tsx";
import { type Attack, AttackChips, type Grip } from "../Attack.tsx";
import { Card } from "../Card.tsx";
import { Field } from "../Field.tsx";
import { ListRow } from "../ListRow.tsx";
import { Popover } from "../Popover.tsx";
import { firstLine, RulesEntries } from "../RulesText.tsx";
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
      <dl className="flex flex-wrap items-end gap-x-5 gap-y-3">
        {COINS.map(([coin, label]) => (
          <div key={coin}>
            <dt className="mb-1 font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
              {label}
            </dt>
            <dd className="min-w-[70px] rounded-control border border-border bg-subtle px-2 py-1.5 text-body">
              {money[coin].toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>
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

function UnresolvedRow({ item }: { item: Extract<SheetItem, { resolved: false }> }) {
  const source = item.source ? ` (${item.source})` : "";
  const variant = item.variant ? `, as ${item.variant.name} (${item.variant.source})` : "";
  return (
    <ListRow
      name={`${item.name}${source}${variant}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`}
      chips={
        <>
          <Marks item={item} />
          <Tag>
            {item.source === undefined ? "Not found in homebrew" : "Not found in the catalog"}
          </Tag>
        </>
      }
    />
  );
}

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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

/**
 * The facts a row's type prints: a weapon's category and die, an armor's category and AC.
 * A weapon with an attack leaves its die to the damage chip.
 */
function TypeChips({ item, attacks }: { item: ResolvedItem; attacks: boolean }) {
  if (item.weapon) {
    const { category, damage } = item.weapon;
    return (
      <>
        {category && <Tag>{capitalize(category)}</Tag>}
        {damage && !attacks && <Tag>{damage.dice}</Tag>}
        {damage?.type && <Tag>{damage.type}</Tag>}
      </>
    );
  }
  if (item.armor) {
    const { category, armorClass } = item.armor;
    return (
      <>
        <Tag>{capitalize(category)}</Tag>
        <Tag>AC {category === "shield" ? `+${armorClass}` : armorClass}</Tag>
      </>
    );
  }
  return item.type?.name ? <Tag>{item.type.name}</Tag> : null;
}

const PILL = "relative rounded-pill px-2 py-0.5 font-bold text-chip leading-3 tracking-chip";

const pillState = (pressed: boolean) =>
  pressed ? `${PILL} bg-accent text-white` : `${PILL} bg-transparent text-muted`;

/**
 * The 1h/2h pill a versatile weapon draws. Two-handed opens a popover saying why in place
 * of pressing while a shield is equipped beside the weapon.
 */
function GripToggle({
  name,
  grip,
  onChange,
  saving,
}: {
  name: string;
  grip: NonNullable<Attack["grip"]>;
  onChange: (grip: Grip) => void;
  saving: boolean;
}) {
  const option = (value: Grip, label: string, spoken: string) => (
    <button
      type="button"
      aria-label={`${label}, ${spoken}`}
      aria-pressed={grip.held === value}
      aria-disabled={saving}
      onClick={() => !saving && grip.held !== value && onChange(value)}
      className={pillState(grip.held === value)}
    >
      {label}
    </button>
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form fields; this groups two toggle buttons.
    <div
      role="group"
      aria-label={`${name} grip`}
      className="flex gap-0.5 rounded-pill bg-border p-px"
    >
      {option("one-handed", "1h", "one-handed")}
      {grip.twoHandedBlocked ? (
        <Popover
          trigger={<span className={`${pillState(false)} opacity-60`}>2h</span>}
          triggerLabel="2h, two-handed, unavailable"
          label="Two-handed"
        >
          Unavailable while this weapon and a shield are both equipped.
        </Popover>
      ) : (
        option("two-handed", "2h", "two-handed")
      )}
    </div>
  );
}

function ResolvedRow({
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
          <TypeChips item={item} attacks={attack !== undefined} />
          {item.quantity > 1 && <Tag>×{item.quantity}</Tag>}
          {rarity && <Tag>{rarity}</Tag>}
          {item.weight !== null && (
            <Tag>
              <span className="sr-only">Weight: </span>
              {pounds(item.weight * item.quantity)}
            </Tag>
          )}
          <Marks item={item} />
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

const GROUPS = ["Weapons", "Armor", "Gear"] as const;

type Group = (typeof GROUPS)[number];

const GROUP_OF_TYPE: Record<string, Group> = {
  M: "Weapons",
  R: "Weapons",
  LA: "Armor",
  MA: "Armor",
  HA: "Armor",
  S: "Armor",
};

/** An item nothing resolves has no type to sort by, so it lands in Gear. */
const groupOf = (item: SheetItem): Group =>
  (item.resolved && item.type && GROUP_OF_TYPE[item.type.abbreviation]) || "Gear";

function ItemList({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived | undefined;
}) {
  const inventory = useCharacterInventory(character.id);
  const update = useUpdateCharacterDefinition(character.id);
  const setGrip = (index: number, grip: Grip) => {
    const { definition } = character;
    update.mutate({
      ...definition,
      inventory: definition.inventory.map((entry, at) =>
        at === index ? { ...entry, grip } : entry,
      ),
    });
  };
  if (inventory.isPending) return <LoadingState label="Loading inventory…" />;
  if (inventory.isError) return <ErrorState message={inventory.error.message} />;
  if (inventory.data.items.length === 0) {
    return <EmptyState>{character.name} has no items yet.</EmptyState>;
  }
  const entries = inventory.data.items.map((item, index) => ({ item, index }));
  const cards = GROUPS.map((group) => {
    const rows = entries.filter(({ item }) => groupOf(item) === group);
    return (
      rows.length > 0 && (
        <Card key={group} title={group}>
          <ul className="flex flex-col gap-2">
            {/* The key is the definition's index, since two entries may hold the same item. */}
            {rows.map(({ item, index }) =>
              item.resolved ? (
                <ResolvedRow
                  key={index}
                  item={item}
                  attack={derived?.attacks.find((attack) => attack.entry === index)}
                  onGrip={(grip) => setGrip(index, grip)}
                  saving={update.isPending}
                />
              ) : (
                <UnresolvedRow key={index} item={item} />
              ),
            )}
          </ul>
        </Card>
      )
    );
  });
  return (
    <>
      {update.isError && (
        <p role="alert" className="text-row">
          The grip was not saved: {update.error.message}
        </p>
      )}
      {cards}
    </>
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
      <div className="grid gap-4 sm:grid-cols-2">
        {derived && <Load character={character} derived={derived} />}
        {derived && <Attunement definition={character.definition} derived={derived} />}
        <div className="sm:col-span-2">
          <Currency money={character.definition.money} />
        </div>
      </div>
      <ItemList character={character} derived={derived} />
    </div>
  );
}
