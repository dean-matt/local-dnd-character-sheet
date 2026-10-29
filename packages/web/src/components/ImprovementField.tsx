import type { FeatRecord } from "@dnd/catalog";
import {
  displayName,
  type EntryRef,
  entryKey,
  type HomebrewNames,
  IMPROVEMENT_FEAT,
  type Improvement,
} from "@dnd/character";
import { useState } from "react";
import { useHomebrewNames } from "../hooks/useHomebrewNames.ts";
import { useOfferedFeats } from "../hooks/useOfferedFeats.ts";
import { alternativesOf, featRow, raisesScores } from "../lib/improvementChoice.ts";
import { type Candidate, improvementFeats, type OfferedFeat } from "../lib/improvementFeats.ts";
import { raisesOf } from "../lib/increasePicks.ts";
import { searchHitKey, searchHitRef } from "../lib/searchHitKey.ts";
import { sharedNameLabel } from "../lib/sharedNameLabel.ts";
import { FormField } from "./FormField.tsx";
import { IncreaseFields } from "./IncreaseFields.tsx";
import { Select } from "./Select.tsx";

const SCORES = "scores";
const UNCHOSEN = "Choose one";

const featKey = (feat: EntryRef | OfferedFeat) =>
  "id" in feat ? searchHitKey(feat) : entryKey(feat);

export interface ImprovementFieldProps {
  /** Names the improvement, such as `Level 4`, in each control's label. */
  name: string;
  improvement: Improvement | undefined;
  /** Every catalog feat in the character's edition. */
  feats: readonly FeatRecord[];
  candidate: Candidate;
  onChange: (next: Improvement) => void;
  /** Outlines every control, as for a change that did not save. */
  invalid?: boolean;
}

/**
 * One Ability Score Improvement or Epic Boon: raise scores, +2 to one or +1 to two, or take
 * a feat the character qualifies for, catalog or homebrew, then place whatever increases the
 * feat offers; a homebrew feat's own row goes unread, so it offers none. A score an increase would carry past its cap is
 * not offered, and the feat already taken stays offered after the character stops
 * qualifying for it.
 */
export function ImprovementField({
  name,
  improvement,
  feats,
  candidate,
  onChange,
  invalid,
}: ImprovementFieldProps) {
  // A classic character raising scores stores nothing until one is placed, so the choice
  // to raise them is held here until then.
  const [raising, setRaising] = useState(false);
  const scores: Improvement =
    candidate.edition === "one" ? { feat: IMPROVEMENT_FEAT, increases: [] } : { increases: [] };
  const current = improvement ?? (raising ? scores : undefined);
  const taken = current?.feat && !raisesScores(current) ? current.feat : undefined;
  const names = useHomebrewNames();
  const offered = improvementFeats(
    useOfferedFeats(candidate.edition, taken ? [taken] : []) ?? [],
    candidate,
  );
  const alternatives = current ? alternativesOf(current, feats, candidate.totals) : [];

  const choose = (value: string) => {
    setRaising(value === SCORES);
    if (value === SCORES) {
      if (improvement !== undefined || scores.feat !== undefined) onChange(scores);
      return;
    }
    const row = offered.find((feat) => featKey(feat) === value);
    const feat = row ? searchHitRef(row) : taken;
    if (!feat) return;
    const fixed = row ? alternativesOf({ feat, increases: [] }, feats, candidate.totals) : [];
    onChange({
      feat,
      increases: fixed.length === 1 ? raisesOf(fixed, { alternative: 0, slots: [] }) : [],
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FormField label={`${name} choice`} labelHidden invalid={invalid}>
        {(control) => (
          <Select
            {...control}
            options={[
              { value: SCORES, label: "Raise ability scores" },
              ...featOptions(offered, taken, feats, names),
            ]}
            value={current === undefined ? UNCHOSEN : taken ? featKey(taken) : SCORES}
            onChange={choose}
          />
        )}
      </FormField>
      {current && (
        <IncreaseFields
          key={taken ? featKey(taken) : SCORES}
          name={name}
          alternatives={alternatives}
          increases={current.increases}
          onChange={(increases) => onChange({ ...current, increases })}
          invalid={invalid}
        />
      )}
    </div>
  );
}

/** Each feat offered, and the one `taken` where the character no longer qualifies for it. */
function featOptions(
  offered: readonly OfferedFeat[],
  taken: EntryRef | undefined,
  feats: readonly FeatRecord[],
  names: HomebrewNames,
) {
  const label = sharedNameLabel(offered);
  const options = offered.map((feat) => ({ value: featKey(feat), label: label(feat) }));
  if (taken === undefined || options.some((option) => option.value === featKey(taken)))
    return options;
  return [
    ...options,
    { value: featKey(taken), label: featRow(feats, taken)?.name ?? displayName(taken, names) },
  ];
}
