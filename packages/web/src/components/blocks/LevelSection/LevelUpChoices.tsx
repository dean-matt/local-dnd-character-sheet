import {
  type CharacterDefinition,
  classLevels,
  derivedValue,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { searchHitKey, searchHitRef } from "../../../lib/searchHitKey.ts";
import { FormField } from "../../FormField.tsx";
import { Select } from "../../Select.tsx";
import { HitPointChoice } from "./HitPointChoice.tsx";
import type { HitPointMethod } from "./hitPointPick.ts";
import { LevelUpPicks } from "./LevelUpPicks.tsx";
import { LevelUpSummary } from "./LevelUpSummary.tsx";
import { MulticlassEntryFields } from "./MulticlassEntryFields.tsx";
import { useClassList } from "./useClassList.ts";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

export interface LevelUpChoicesProps {
  characterId: string;
  definition: CharacterDefinition;
  plan: ReturnType<typeof useLevelUpPlan>;
  method: HitPointMethod | undefined;
  onMethod: (method: HitPointMethod | undefined) => void;
}

/**
 * Every choice the level asks for, in order: the class, from one list of those the
 * character holds and those it could multiclass into, with what entering a new one asks;
 * the hit points, then the picks from the subclass on. Then the features the level brings.
 */
export function LevelUpChoices({
  characterId,
  definition,
  plan,
  method,
  onMethod,
}: LevelUpChoicesProps) {
  const derived = useCharacterDerived(characterId);
  const groups = classLevels(definition);
  const { target, die, level } = plan;
  const { entering } = plan.entry;
  const held = new Set(groups.map((group) => entryKey(group.class)));
  const classes = useClassList(definition.edition);
  const fresh = classes.hits.filter((hit) => !held.has(searchHitKey(hit)));
  const pickClass = (cls: EntryRef) => {
    plan.setClass(cls);
    onMethod(undefined);
  };
  return (
    <>
      <FormField label="Class">
        {(control) => (
          <Select
            {...control}
            options={[
              ...groups.map((group) => ({
                value: entryKey(group.class),
                label: `${displayName(group.class)} ${group.level} → ${group.level + 1}`,
              })),
              ...fresh.map((hit) => ({
                value: searchHitKey(hit),
                label: `${classes.label(hit)} (new) → 1`,
              })),
            ]}
            value={entryKey(level.class)}
            onChange={(value) => {
              const group = groups.find((each) => entryKey(each.class) === value);
              const hit = fresh.find((each) => searchHitKey(each) === value);
              if (group) pickClass(group.class);
              else if (hit) pickClass(searchHitRef(hit));
            }}
          />
        )}
      </FormField>
      {classes.failed && (
        <p className="text-error">Couldn't load the classes to multiclass into.</p>
      )}
      {entering && target.read && <MulticlassEntryFields name={target.name} plan={plan} />}
      {!target.read ? (
        <p className="text-muted">Loading the class…</p>
      ) : die === undefined ? (
        <p className="text-error">
          {target.name} has no hit die the sheet can read, so it cannot take a level here.
        </p>
      ) : (
        <HitPointChoice
          key={entryKey(level.class)}
          die={die}
          constitution={derived.data && derivedValue(derived.data.abilityModifiers.con)}
          method={method}
          rolled={level.rolled}
          onChange={(next, rolled) => {
            onMethod(next);
            plan.setRolled(rolled, next === "custom");
          }}
        />
      )}
      <LevelUpPicks edition={definition.edition} plan={plan} />
      <LevelUpSummary changes={plan.table()} features={plan.features} />
      <p className="text-muted text-row">
        Hit points, proficiency bonus and spell slots are worked out once you apply, and the summary
        then lists each that moved.
      </p>
    </>
  );
}
