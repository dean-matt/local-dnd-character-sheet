import type { ItemCharges as Charges } from "@dnd/catalog";
import {
  type CharacterRecord,
  characterDefinitionSchema,
  itemChargesSpent,
  withItemChargesSpent,
} from "@dnd/character";
import { Minus, Plus } from "lucide-react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Field } from "../../../Field/Field.tsx";
import { PoolButton } from "../../../PoolButton.tsx";
import { editInventoryEntry } from "./editInventoryEntry.ts";
import { rechargeLabel } from "./rechargeLabel.ts";

const maxSchema = characterDefinitionSchema.shape.inventory.element.shape.chargesMax.unwrap();

/**
 * An item's charges left against its maximum and when it recharges, with a spend, a restore and
 * a field for the table's own maximum, each one write announced once it lands. Spent charges
 * are play state keyed by the entry's `id`, so an entry without one is given its `id` by a
 * definition write before its first charge is spent. Nothing shows until state loads.
 */
export function ItemCharges({
  character,
  index,
  name,
  charges,
  busy,
  onMax,
}: {
  character: CharacterRecord;
  index: number;
  name: string;
  charges: Charges;
  busy: boolean;
  onMax: (max: number | undefined) => Promise<void>;
}) {
  const state = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const definition = useUpdateCharacterDefinition(character.id);
  const entry = character.definition.inventory[index];
  if (!state.isSuccess || !entry) return null;

  const spent = entry.id ? itemChargesSpent(state.data.state, entry.id, charges.max) : 0;
  const left = charges.max - spent;
  const disabled = busy || replace.writing || definition.isPending;

  async function change(next: number) {
    if (!entry) return;
    const id = entry.id ?? crypto.randomUUID();
    try {
      if (!entry.id) {
        await definition.mutateAsync((latest) =>
          editInventoryEntry(latest, index, entry, (at) => ({ ...at, id })),
        );
      }
      const ids = new Set(character.definition.inventory.flatMap((at) => at.id ?? []));
      ids.add(id);
      await replace.mutateAsync((latest) => withItemChargesSpent(latest, ids, id, next));
    } catch {
      return;
    }
    replace.announce(`${name}: ${charges.max - next} of ${charges.max} charges left.`);
  }

  const failure = replace.error ?? definition.error;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-row">
        {left} / {charges.max} charges
        {charges.recharge && <span className="text-muted"> {rechargeLabel(charges.recharge)}</span>}
      </span>
      <PoolButton
        icon={Minus}
        label={`Spend a charge of ${name}`}
        tooltip="Spend a charge"
        disabled={disabled || left === 0}
        onPress={() => change(spent + 1)}
      />
      <PoolButton
        icon={Plus}
        label={`Restore a charge of ${name}`}
        tooltip="Restore a charge"
        disabled={disabled || spent === 0}
        onPress={() => change(spent - 1)}
      />
      <Field
        mode="edit"
        label={`${name} maximum charges`}
        labelHidden
        inputMode="numeric"
        inputClassName="w-12 text-right"
        current={charges.max}
        format={String}
        parse={(raw) => Number(raw.trim())}
        schema={maxSchema}
        onSave={(max: number) => onMax(max === charges.printedMax ? undefined : max)}
      />
      {failure && (
        <span role="alert" className="text-error text-row">
          {name} was not changed: {failure.message}
        </span>
      )}
      <Announcer announced={replace.announced} />
    </span>
  );
}
