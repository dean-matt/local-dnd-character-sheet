import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { EquipmentSourceField } from "./EquipmentSourceField.tsx";
import { ExtraItemsField } from "./ExtraItemsField.tsx";
import { type EquipmentMemory, picksFor, withoutLanded } from "./equipmentPicks.ts";
import { useHeldEquipment } from "./useHeldEquipment.ts";

export interface StartingEquipmentFieldProps {
  /** The picks the flow holds, which a reload loses. */
  memory: EquipmentMemory | undefined;
  onMemory: (memory: EquipmentMemory) => void;
}

/**
 * The class's and the background's starting equipment, each list's picks, and a picker
 * for anything past them. `CreationEquipment` lands what the picks hand over.
 */
export function StartingEquipmentField({ memory, onMemory }: StartingEquipmentFieldProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const edition = useWatch<CharacterDefinition, "edition">({ name: "edition" }) ?? "one";
  const { sources, held, extras } = useHeldEquipment(memory);

  if (sources === undefined || held === undefined) return null;
  const named = (ref: EntryRef, picked: string) => ({ ...held.names, [entryKey(ref)]: picked });
  return (
    <div className="flex flex-col gap-5">
      {sources.length === 0 && (
        <p className="text-muted text-row">
          Neither the class nor the background lists starting equipment.
        </p>
      )}
      {sources.map((source) => (
        <EquipmentSourceField
          key={source.by}
          edition={edition}
          source={source}
          picks={picksFor(held, source)}
          names={held.names}
          onPicks={(picks, slot) =>
            onMemory({
              ...held,
              picks: { ...held.picks, [source.by]: picks },
              names: slot ? named(slot.ref, slot.name) : held.names,
            })
          }
        />
      ))}
      <ExtraItemsField
        edition={edition}
        extras={extras}
        names={held.names}
        onAdd={(ref, picked) => {
          onMemory({ ...held, names: named(ref, picked) });
          setValue(
            "inventory",
            [
              ...(getValues("inventory") ?? []),
              { ref, quantity: 1, carried: true, equipped: false, attuned: false },
            ],
            { shouldDirty: true },
          );
        }}
        onRemove={(index) => {
          const gone = extras[index];
          if (gone === undefined) return;
          setValue("inventory", withoutLanded(getValues("inventory") ?? [], [gone]), {
            shouldDirty: true,
          });
        }}
      />
    </div>
  );
}
