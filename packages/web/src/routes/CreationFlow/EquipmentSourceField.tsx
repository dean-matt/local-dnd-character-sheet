import type { CharacterDefinition, EntryRef } from "@dnd/character";
import { useId } from "react";
import { EquipmentSlotField } from "./EquipmentSlotField.tsx";
import { optionLabel, pickedName } from "./equipmentLabels.ts";
import {
  chosenOption,
  type EquipmentSource,
  type OfferedOption,
  type SourcePicks,
  slotKeys,
} from "./equipmentPicks.ts";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";

export interface EquipmentSourceFieldProps {
  edition: CharacterDefinition["edition"];
  source: EquipmentSource;
  picks: SourcePicks;
  names: Record<string, string>;
  /** `named` is an item a slot took and the name it was picked under, which a homebrew reference does not carry. */
  onPicks: (picks: SourcePicks, named?: { ref: EntryRef; name: string }) => void;
}

/**
 * A class's or a background's starting equipment as its list prints it: each line given
 * outright or a pick between options, and a slot under the option for any item of a kind.
 */
export function EquipmentSourceField({
  edition,
  source,
  picks,
  names,
  onPicks,
}: EquipmentSourceFieldProps) {
  const id = useId();

  const slots = (option: OfferedOption, index: number) =>
    option.items.flatMap((item, at) => {
      if (item.kind !== "type") return [];
      const keys = slotKeys(index, option.key, at, item.quantity);
      return keys.map((key, copy) => {
        const slot = picks.slots[key];
        return (
          <EquipmentSlotField
            key={key}
            edition={edition}
            types={item.types}
            copy={keys.length > 1 ? { of: keys.length, at: copy + 1 } : undefined}
            picked={slot && pickedName(slot, names)}
            onPick={(ref, hit) =>
              onPicks({ ...picks, slots: { ...picks.slots, [key]: ref } }, { ref, name: hit.name })
            }
            onClear={() => {
              const { [key]: _, ...rest } = picks.slots;
              onPicks({ ...picks, slots: rest });
            }}
          />
        );
      });
    });

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className={HEADING}>
        From {source.by}: {source.name}
      </h2>
      {source.groups.length === 0 && (
        <p className="text-muted text-row">The {source.by.toLowerCase()} lists no equipment.</p>
      )}
      {source.groups.map((group, index) => {
        const chosen = chosenOption(group, index, picks);
        if (group.length === 1 && group[0])
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a group is its line in the row's list.
            <div key={index} className="flex flex-col gap-1.5 text-body">
              <p>{optionLabel(group[0])}</p>
              {slots(group[0], index)}
            </div>
          );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a group is its line in the row's list.
          <fieldset key={index} className="flex flex-col gap-1">
            <legend
              className={`mb-1 text-row ${chosen ? "text-muted" : "font-semibold text-accent-text"}`}
            >
              {source.by} line {index + 1} — {chosen ? "choose one" : "choose one, not chosen yet"}
            </legend>
            {group.map((option) => (
              <label key={option.key} className="flex items-start gap-2 py-0.5 text-body">
                <input
                  type="radio"
                  name={`${id}-${index}`}
                  checked={chosen?.key === option.key}
                  onChange={() =>
                    onPicks({ ...picks, options: { ...picks.options, [index]: option.key } })
                  }
                  className="mt-1"
                />
                <span>
                  ({option.key}) {optionLabel(option)}
                </span>
              </label>
            ))}
            {chosen && <div className="mt-1 flex flex-col gap-2">{slots(chosen, index)}</div>}
          </fieldset>
        );
      })}
    </section>
  );
}
