import type { SubclassRecord } from "@dnd/catalog";
import {
  type CharacterDefinition,
  classLevels,
  derivedValue,
  displayName,
  entryKey,
  featureKey,
  refKey,
} from "@dnd/character";
import { useCharacterDerived } from "../../../../hooks/useCharacterDerived.ts";
import { useDisabledSources } from "../../../../hooks/useDisabledSources.ts";
import { shownOptions } from "../../../../lib/featureChoices.ts";
import { grantTitle } from "../../../../lib/improvementGrants.ts";
import { FormField } from "../../../FormField.tsx";
import { ImprovementField } from "../../../ImprovementField.tsx";
import { Select } from "../../../Select.tsx";
import { HitPointChoice } from "./HitPointChoice.tsx";
import type { HitPointMethod } from "./hitPointPick.ts";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

const UNCHOSEN = "Choose one";
const subclassKey = (row: Pick<SubclassRecord, "name" | "source">) => `${row.name}|${row.source}`;

export interface LevelUpChoicesProps {
  characterId: string;
  definition: CharacterDefinition;
  plan: ReturnType<typeof useLevelUpPlan>;
  method: HitPointMethod | undefined;
  onMethod: (method: HitPointMethod | undefined) => void;
}

/**
 * Every choice the level asks for, in order: the class where the character holds more than
 * one, the hit points, a subclass at the class's subclass level, an improvement, and each
 * option a feature offers. Then the features the level brings.
 */
export function LevelUpChoices({
  characterId,
  definition,
  plan,
  method,
  onMethod,
}: LevelUpChoicesProps) {
  const derived = useCharacterDerived(characterId);
  const disabled = useDisabledSources();
  const groups = classLevels(definition);
  const { target, die, level, grant, candidate } = plan;
  return (
    <>
      {groups.length > 1 ? (
        <FormField label="Class">
          {(control) => (
            <Select
              {...control}
              options={groups.map((group) => ({
                value: entryKey(group.class),
                label: `${displayName(group.class)} ${group.level} → ${group.level + 1}`,
              }))}
              value={entryKey(level.class)}
              onChange={(value) => {
                const group = groups.find((each) => entryKey(each.class) === value);
                if (!group) return;
                plan.setClass(group.class);
                onMethod(undefined);
              }}
            />
          )}
        </FormField>
      ) : (
        <p className="font-semibold">
          {target.name} {target.level} → {target.next}
        </p>
      )}
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
            plan.setRolled(rolled);
          }}
        />
      )}
      {target.asksSubclass && (
        <FormField label={`${target.name} subclass`}>
          {(control) => (
            <Select
              {...control}
              options={target.subclasses.map((each) => ({
                value: subclassKey(each),
                label: each.name,
              }))}
              value={level.subclass ? subclassKey(level.subclass) : UNCHOSEN}
              onChange={(value) => {
                const each = target.subclasses.find((option) => subclassKey(option) === value);
                plan.setSubclass(each && { name: each.name, source: each.source });
              }}
            />
          )}
        </FormField>
      )}
      {grant && candidate && (
        <section aria-labelledby="level-up-improvement" className="flex flex-col gap-1.5">
          <h3 id="level-up-improvement" className="font-semibold text-label text-muted uppercase">
            {grantTitle(grant)}
          </h3>
          <ImprovementField
            name={`Level ${grant.level}`}
            improvement={plan.improvement}
            feats={plan.catalogFeats}
            candidate={candidate}
            onChange={plan.setImprovement}
          />
        </section>
      )}
      {plan.offerings.map((offering) => {
        const option = plan.chosen(offering);
        return (
          <FormField key={featureKey(offering.feature)} label={offering.feature.name}>
            {(control) => (
              <Select
                {...control}
                options={shownOptions(offering.options, option, disabled).map((each) => ({
                  value: refKey(each),
                  label: each.name,
                }))}
                value={option ? refKey(option) : UNCHOSEN}
                onChange={(value) => {
                  const each = offering.options.find((one) => refKey(one) === value);
                  if (each) plan.choose(offering, each);
                }}
              />
            )}
          </FormField>
        );
      })}
      {plan.features.length > 0 && (
        <p>
          <span className="font-semibold">
            New at {target.name} {target.next}:
          </span>{" "}
          {plan.features.join(", ")}
        </p>
      )}
      <p className="text-muted text-row">
        Spell slots and resources follow the class table once you apply, and the summary then lists
        each value that moved.
      </p>
    </>
  );
}
