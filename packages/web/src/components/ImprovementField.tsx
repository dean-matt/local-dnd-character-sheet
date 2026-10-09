import type { FeatRecord, IncreaseAlternative } from "@dnd/catalog";
import {
  ABILITY_LABEL,
  type Ability,
  displayName,
  type EntryRef,
  entryKey,
  IMPROVEMENT_CAP,
  IMPROVEMENT_FEAT,
  type Improvement,
} from "@dnd/character";
import { useState } from "react";
import { alternativesOf, featRow, raisesScores } from "../lib/improvementChoice.ts";
import { type Candidate, improvementFeats } from "../lib/improvementFeats.ts";
import { type Picks, raisesOf, readPicks } from "../lib/increasePicks.ts";
import { signed } from "./blocks/signed.ts";
import { FormField } from "./FormField.tsx";
import { Select } from "./Select.tsx";

const SCORES = "scores";
const UNCHOSEN = "Choose one";

const amounts = (alternative: IncreaseAlternative) =>
  alternative.slots.map((slot) => signed(slot.amount)).join(" and ");

const featKey = (feat: EntryRef | FeatRecord) =>
  entryKey("homebrewId" in feat ? feat : { name: feat.name, source: feat.source });

export interface ImprovementFieldProps {
  /** Names the improvement, such as `Level 4`, in each control's label. */
  name: string;
  improvement: Improvement | undefined;
  /** Every catalog feat in the character's edition. */
  feats: readonly FeatRecord[];
  candidate: Candidate;
  onChange: (next: Improvement) => void;
}

/**
 * One Ability Score Improvement or Epic Boon: raise scores, +2 to one or +1 to two, or take
 * a feat the character qualifies for, then place whatever increases the feat offers. A
 * score an increase would carry past its cap is not offered, and the feat already taken
 * stays offered after the character stops qualifying for it.
 */
export function ImprovementField({
  name,
  improvement,
  feats,
  candidate,
  onChange,
}: ImprovementFieldProps) {
  // Stored increases say what was placed but not which alternative: with nothing placed,
  // +1 and +1 reads as +2. What the player picked is held here while it matches the store.
  const [placed, setPlaced] = useState<Picks>();
  // A classic character raising scores stores nothing until one is placed, so the choice
  // to raise them is held here until then.
  const [raising, setRaising] = useState(false);
  const scores: Improvement =
    candidate.edition === "one" ? { feat: IMPROVEMENT_FEAT, increases: [] } : { increases: [] };
  const current = improvement ?? (raising ? scores : undefined);
  const offered = improvementFeats(feats, candidate);
  const taken = current?.feat && !raisesScores(current) ? current.feat : undefined;
  const alternatives = current ? alternativesOf(current, feats) : [];
  const read = current && readPicks(alternatives, current.increases);
  const picks: Picks =
    placed && read && alternatives[placed.alternative] && sameRaises(placed, read, alternatives)
      ? placed
      : (read ?? { alternative: 0, slots: [] });
  const alternative = alternatives[picks.alternative];

  const choose = (value: string) => {
    setPlaced(undefined);
    setRaising(value === SCORES);
    if (value === SCORES) {
      if (improvement !== undefined || scores.feat !== undefined) onChange(scores);
      return;
    }
    const row = offered.find((feat) => featKey(feat) === value);
    const feat = row ? { name: row.name, source: row.source } : taken;
    if (!feat) return;
    const fixed = row ? alternativesOf({ feat, increases: [] }, feats) : [];
    onChange({
      feat,
      increases: fixed.length === 1 ? raisesOf(fixed, { alternative: 0, slots: [] }) : [],
    });
  };
  const place = (next: Picks) => {
    if (!current) return;
    setPlaced(next);
    onChange({ ...current, increases: raisesOf(alternatives, next) });
  };
  const cap = alternative?.max ?? IMPROVEMENT_CAP;
  const fits = (ability: Ability, amount: number) =>
    candidate.totals === undefined || candidate.totals[ability] + amount <= cap;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormField label={`${name} choice`} labelHidden>
        {(control) => (
          <Select
            {...control}
            options={[
              { value: SCORES, label: "Raise ability scores" },
              ...featOptions(offered, taken, feats),
            ]}
            value={current === undefined ? UNCHOSEN : taken ? featKey(taken) : SCORES}
            onChange={choose}
          />
        )}
      </FormField>
      {alternatives.length > 1 && (
        <FormField label={`${name} increase`} labelHidden>
          {(control) => (
            <Select
              {...control}
              options={alternatives.map((each, index) => ({
                value: String(index),
                label: amounts(each),
              }))}
              value={String(picks.alternative)}
              onChange={(value) => place({ alternative: Number(value), slots: [] })}
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
          >
            {(control) => (
              <Select
                {...control}
                options={slot.from
                  .filter(
                    (ability) =>
                      ability === held ||
                      (!elsewhere.includes(ability) && fits(ability, slot.amount)),
                  )
                  .map((ability) => ({
                    value: ability,
                    label: `${signed(slot.amount)} ${ABILITY_LABEL[ability]}`,
                  }))}
                value={held ?? UNCHOSEN}
                onChange={(value) =>
                  place({
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
    </div>
  );
}

/** Each feat offered, and the one `taken` where the character no longer qualifies for it. */
function featOptions(
  offered: readonly FeatRecord[],
  taken: EntryRef | undefined,
  feats: readonly FeatRecord[],
) {
  const options = offered.map((feat) => ({ value: featKey(feat), label: feat.name }));
  if (taken === undefined || options.some((option) => option.value === featKey(taken)))
    return options;
  return [
    ...options,
    { value: featKey(taken), label: featRow(feats, taken)?.name ?? displayName(taken) },
  ];
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
