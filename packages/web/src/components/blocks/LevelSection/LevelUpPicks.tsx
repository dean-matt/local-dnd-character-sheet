import type { SubclassRecord } from "@dnd/catalog";
import { type CharacterDefinition, entryKey, featureKey, refKey } from "@dnd/character";
import { useId } from "react";
import { useDisabledSources } from "../../../hooks/useDisabledSources.ts";
import { shownOptions } from "../../../lib/featureChoices.ts";
import { grantTitle } from "../../../lib/improvementGrants.ts";
import { FormField } from "../../FormField.tsx";
import { ImprovementField } from "../../ImprovementField.tsx";
import { Select } from "../../Select.tsx";
import { LevelUpOptions } from "./LevelUpOptions.tsx";
import { LevelUpSpells } from "./LevelUpSpells.tsx";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

const UNCHOSEN = "Choose one";
const subclassKey = (row: Pick<SubclassRecord, "name" | "source">) => `${row.name}|${row.source}`;

export interface LevelUpPicksProps {
  edition: CharacterDefinition["edition"];
  plan: ReturnType<typeof useLevelUpPlan>;
}

/**
 * The picks a level asks for once its class is set: a subclass at the class's subclass
 * level, an improvement, each option a feature offers, the optional features, cantrips and
 * spells the level adds.
 */
export function LevelUpPicks({ edition, plan }: LevelUpPicksProps) {
  const improvementId = useId();
  const disabled = useDisabledSources();
  const { target, level, grant, candidate } = plan;
  return (
    <>
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
        <section aria-labelledby={improvementId} className="flex flex-col gap-1.5">
          <h3 id={improvementId} className="font-semibold text-label text-muted uppercase">
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
      <LevelUpOptions plan={plan} />
      <LevelUpSpells
        key={`spells:${entryKey(level.class)}`}
        edition={edition}
        className={target.name}
        picks={plan.spellPicks}
      />
    </>
  );
}
