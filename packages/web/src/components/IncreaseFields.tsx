import type { IncreaseAlternative } from "@dnd/catalog";
import { ABILITY_LABEL, type Ability, type Raise } from "@dnd/character";
import { useState } from "react";
import { type Picks, raisesOf, readPicks } from "../lib/increasePicks.ts";
import { signed } from "./blocks/signed.ts";
import { FormField } from "./FormField.tsx";
import { Select } from "./Select.tsx";

const UNCHOSEN = "Choose one";

const amounts = (alternative: IncreaseAlternative) =>
  alternative.slots.map((slot) => signed(slot.amount)).join(" and ");

export interface IncreaseFieldsProps {
  /** Names what grants the increases, such as `Level 4`, in each control's label. */
  name: string;
  alternatives: readonly IncreaseAlternative[];
  increases: readonly Raise[];
  onChange: (next: Raise[]) => void;
  invalid?: boolean;
}

/**
 * The increases a row offers to place: which alternative, where it offers more than one,
 * then the ability each of its slots raises, never one another slot already holds. Key it
 * by what offers the increases, so a new offer starts from what is stored.
 */
export function IncreaseFields({
  name,
  alternatives,
  increases,
  onChange,
  invalid,
}: IncreaseFieldsProps) {
  // Stored increases say what was placed but not which alternative: with nothing placed,
  // +1 and +1 reads as +2. What the player picked is held here while it matches the store.
  const [placed, setPlaced] = useState<Picks>();
  const read = readPicks(alternatives, increases);
  const picks: Picks =
    placed && read && alternatives[placed.alternative] && sameRaises(placed, read, alternatives)
      ? placed
      : (read ?? { alternative: 0, slots: [] });
  const alternative = alternatives[picks.alternative];
  const onPlace = (next: Picks) => {
    setPlaced(next);
    onChange(raisesOf(alternatives, next));
  };
  return (
    <>
      {alternatives.length > 1 && (
        <FormField label={`${name} increase`} labelHidden invalid={invalid}>
          {(control) => (
            <Select
              {...control}
              options={alternatives.map((each, index) => ({
                value: String(index),
                label: amounts(each),
              }))}
              value={String(picks.alternative)}
              onChange={(value) => onPlace({ alternative: Number(value), slots: [] })}
            />
          )}
        </FormField>
      )}
      {alternative?.slots.map((slot, index) => {
        const held = picks.slots[index];
        const elsewhere = picks.slots.filter((_, other) => other !== index);
        const count = alternative.slots.length;
        return (
          <FormField
            // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position.
            key={index}
            label={`${name} ${signed(slot.amount)}${count > 1 ? `, ${index + 1} of ${count}` : ""}`}
            labelHidden
            invalid={invalid}
          >
            {(control) => (
              <Select
                {...control}
                options={slot.from
                  .filter((ability) => ability === held || !elsewhere.includes(ability))
                  .map((ability) => ({
                    value: ability,
                    label: `${signed(slot.amount)} ${ABILITY_LABEL[ability]}`,
                  }))}
                value={held ?? UNCHOSEN}
                onChange={(value) =>
                  onPlace({
                    alternative: picks.alternative,
                    slots: alternative.slots.map((_, at) =>
                      at === index ? (value as Ability) : picks.slots[at],
                    ),
                  })
                }
              />
            )}
          </FormField>
        );
      })}
    </>
  );
}

/** Whether `placed` stores what `read` reads back, so it is the same choice. */
function sameRaises(placed: Picks, read: Picks, alternatives: readonly IncreaseAlternative[]) {
  const tally = (picks: Picks) =>
    raisesOf(alternatives, picks)
      .map(({ ability, amount }) => `${ability}${amount}`)
      .sort()
      .join();
  return tally(placed) === tally(read);
}
