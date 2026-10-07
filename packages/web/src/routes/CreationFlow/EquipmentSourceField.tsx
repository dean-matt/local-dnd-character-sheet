import type { CharacterDefinition, EntryRef } from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useId } from "react";
import { EquipmentSlotField } from "./EquipmentSlotField.tsx";
import { optionLabel, pickedName } from "./equipmentLabels.ts";
import {
  chosenOption,
  type EquipmentSource,
  type OfferedOption,
  type SourcePicks,
  slotKey,
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
 * outright or a pick between options, a slot under the option for any item of a kind, and
 * a classic class's gold alternative, rolled when taken, in place of the lot.
 */
export function EquipmentSourceField({
  edition,
  source,
  picks,
  names,
  onPicks,
}: EquipmentSourceFieldProps) {
  const id = useId();
  const gold = source.goldAlternative;
  const takingGold = gold !== undefined && picks.gold !== undefined;

  const slots = (option: OfferedOption, index: number) =>
    option.items.map((item, at) => {
      if (item.kind !== "type") return null;
      const key = slotKey(index, option.key, at);
      const slot = picks.slots[key];
      return (
        <EquipmentSlotField
          key={key}
          edition={edition}
          types={item.types}
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

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className={HEADING}>
        From {source.by}: {source.name}
      </h2>
      {gold && (
        <label className="flex items-center gap-2 text-body">
          <input
            type="checkbox"
            checked={takingGold}
            onChange={() => {
              const { gold: _, ...rest } = picks;
              onPicks(
                takingGold ? rest : { ...picks, gold: rollDice(gold.dice).total * gold.multiplier },
              );
            }}
          />
          Take {gold.dice}
          {gold.multiplier > 1 && ` × ${gold.multiplier}`} gp instead of the equipment below
        </label>
      )}
      {takingGold && <p className="text-muted text-row">Rolled {picks.gold} gp.</p>}
      {source.groups.length === 0 && (
        <p className="text-muted text-row">The {source.by.toLowerCase()} lists no equipment.</p>
      )}
      {!takingGold &&
        source.groups.map((group, index) => {
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
                {chosen ? "Choose one" : "Choose one — not chosen yet"}
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
