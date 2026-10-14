import type { SearchHit, SubclassRecord } from "@dnd/catalog";
import {
  type CharacterDefinition,
  classLevels,
  derivedValue,
  displayName,
  type EntryRef,
  entryKey,
  featureKey,
  refKey,
} from "@dnd/character";
import { useId } from "react";
import { useCatalogSearch } from "../../../../hooks/useCatalogSearch.ts";
import { useCharacterDerived } from "../../../../hooks/useCharacterDerived.ts";
import { useDisabledSources } from "../../../../hooks/useDisabledSources.ts";
import { shownOptions } from "../../../../lib/featureChoices.ts";
import { grantTitle } from "../../../../lib/improvementGrants.ts";
import { searchHitKey } from "../../../../lib/searchHitKey.ts";
import { FormField } from "../../../FormField.tsx";
import { ImprovementField } from "../../../ImprovementField.tsx";
import { Select } from "../../../Select.tsx";
import { HitPointChoice } from "./HitPointChoice.tsx";
import type { HitPointMethod } from "./hitPointPick.ts";
import { LevelUpSpells } from "./LevelUpSpells.tsx";
import { LevelUpSummary } from "./LevelUpSummary.tsx";
import { MulticlassEntryFields } from "./MulticlassEntryFields.tsx";
import type { useLevelUpPlan } from "./useLevelUpPlan.ts";

const UNCHOSEN = "Choose one";
const subclassKey = (row: Pick<SubclassRecord, "name" | "source">) => `${row.name}|${row.source}`;
const toRef = (hit: SearchHit): EntryRef =>
  "id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source };
const hitSource = (hit: SearchHit) => ("id" in hit ? "homebrew" : hit.source);
// Above every class one edition and the homebrew hold together; past it, the classes
// beyond go unoffered until this pages.
const CLASS_LIMIT = 200;

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
 * the hit points, a subclass at the class's subclass level, an improvement, each option a
 * feature offers, and the cantrips and spells the level adds. Then the features the level
 * brings.
 */
export function LevelUpChoices({
  characterId,
  definition,
  plan,
  method,
  onMethod,
}: LevelUpChoicesProps) {
  const improvementId = useId();
  const derived = useCharacterDerived(characterId);
  const disabled = useDisabledSources();
  const groups = classLevels(definition);
  const { target, die, level, grant, candidate } = plan;
  const { entering } = plan.entry;
  const held = new Set(groups.map((group) => entryKey(group.class)));
  const classes = useCatalogSearch({
    edition: definition.edition,
    type: "class",
    query: "",
    limit: CLASS_LIMIT,
    listAll: true,
  });
  const fresh = (classes.data?.items ?? []).filter((hit) => !held.has(searchHitKey(hit)));
  const names = fresh.map((hit) => hit.name);
  const shared = new Set(names.filter((name, index) => names.indexOf(name) !== index));
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
                label: `${shared.has(hit.name) ? `${hit.name} (${hitSource(hit)})` : hit.name} (new) → 1`,
              })),
            ]}
            value={entryKey(level.class)}
            onChange={(value) => {
              const group = groups.find((each) => entryKey(each.class) === value);
              const hit = fresh.find((each) => searchHitKey(each) === value);
              if (group) pickClass(group.class);
              else if (hit) pickClass(toRef(hit));
            }}
          />
        )}
      </FormField>
      {classes.isError && (
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
      <LevelUpSpells
        key={`spells:${entryKey(level.class)}`}
        edition={definition.edition}
        className={target.name}
        picks={plan.spellPicks}
      />
      <LevelUpSummary changes={plan.table()} features={plan.features} />
      <p className="text-muted text-row">
        Hit points, proficiency bonus and spell slots are worked out once you apply, and the summary
        then lists each that moved.
      </p>
    </>
  );
}
