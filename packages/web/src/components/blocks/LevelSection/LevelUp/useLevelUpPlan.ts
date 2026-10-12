import {
  type CharacterDefinition,
  type ContentRef,
  type EntryRef,
  HIT_DICE,
  type Improvement,
  improvementAt,
  withImprovement,
} from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { useFeats } from "../../../../hooks/useFeats.ts";
import { useImprovementGrants } from "../../../../hooks/useImprovementGrants.ts";
import { takenOption, withFeatureChoice } from "../../../../lib/featureChoices.ts";
import { type FeatureOffering, featureOfferings } from "../../../../lib/featureOfferings.ts";
import { isMade } from "../../../../lib/improvementChoice.ts";
import { candidateAt } from "../../../../lib/improvementFeats.ts";
import type { HitPointMethod } from "./hitPointPick.ts";
import { featuresAt, tableChanges } from "./levelUpChanges.ts";
import { useLevelUpClass } from "./useLevelUpClass.ts";

type Level = CharacterDefinition["levels"][number];

/**
 * The level the draft holds last, on top of `definition`, read from the level-up form: the
 * choices it asks for, whether each is made, and the edits that make them. A change of
 * class takes back every choice made since, and a change of subclass the options its
 * features offered, since each read the old one.
 */
export function useLevelUpPlan(
  definition: CharacterDefinition,
  method: HitPointMethod | undefined,
) {
  const { setValue } = useFormContext<CharacterDefinition>();
  const [levels = [], feats = [], abilityIncreases = [], featureChoices = []] = useWatch<
    CharacterDefinition,
    ["levels", "feats", "abilityIncreases", "featureChoices"]
  >({ name: ["levels", "feats", "abilityIncreases", "featureChoices"] });
  // The schema holds at least one level, which the inferred array type cannot say.
  const level = (levels.at(-1) ?? definition.levels.at(-1)) as Level;
  const target = useLevelUpClass(definition, level.class, level.subclass);
  const featList = useFeats(definition.edition);
  const die = HIT_DICE.find((each) => each === target.hitDie);
  const improvements = useImprovementGrants(levels);
  const grant = improvements.grants.find((each) => each.level === levels.length);
  const draft = { ...definition, levels, feats, abilityIncreases };
  const candidate = grant && candidateAt(draft, grant);
  const improvement = grant && improvementAt(draft, grant.level);
  const catalogFeats = featList.data?.items ?? [];
  const offerings = offeringsAt(level.class, target);
  const chosen = (offering: FeatureOffering) =>
    takenOption(featureChoices, offering.feature, offering.options);

  const dirty = { shouldDirty: true };
  const withLevel = (next: Level) => [...definition.levels, next];
  const restart = () => {
    setValue("feats", definition.feats, dirty);
    setValue("abilityIncreases", definition.abilityIncreases, dirty);
    setValue("featureChoices", definition.featureChoices, dirty);
  };

  const ready =
    target.read &&
    die !== undefined &&
    (method === "average" || level.rolled !== undefined) &&
    (!target.asksSubclass || level.subclass !== undefined) &&
    improvements.read &&
    (grant === undefined ||
      (featList.isSuccess && isMade(improvement, catalogFeats, candidate?.totals))) &&
    offerings.every((offering) => chosen(offering) !== undefined);

  return {
    target,
    die,
    level,
    grant,
    candidate,
    improvement,
    catalogFeats,
    offerings,
    chosen,
    ready,
    features: [
      ...featuresAt(target.after?.features ?? [], target.next),
      ...featuresAt(target.subclassAfter?.features ?? [], target.subclassFrom, target.next),
    ],
    table: () => [
      ...(target.after ? tableChanges(target.before, target.after) : []),
      ...(target.subclassAfter ? tableChanges(target.subclassBefore, target.subclassAfter) : []),
    ],
    setClass: (cls: EntryRef) => {
      setValue("levels", withLevel({ class: cls }), dirty);
      restart();
    },
    setSubclass: (subclass: ContentRef | undefined) => {
      const { subclass: _, ...rest } = level;
      setValue("levels", withLevel(subclass ? { ...rest, subclass } : rest), dirty);
      setValue("featureChoices", definition.featureChoices, dirty);
    },
    setRolled: (rolled: number | undefined) => {
      const { rolled: _, ...rest } = level;
      setValue("levels", withLevel(rolled === undefined ? rest : { ...rest, rolled }), dirty);
    },
    setImprovement: (next: Improvement) => {
      if (!grant) return;
      const held = withImprovement(draft, grant.level, grant.cls, next);
      setValue("feats", held.feats, dirty);
      setValue("abilityIncreases", held.abilityIncreases, dirty);
    },
    choose: (offering: FeatureOffering, option: ContentRef) =>
      setValue(
        "featureChoices",
        withFeatureChoice(featureChoices, offering.feature, [option]),
        dirty,
      ),
  };
}

/**
 * The choices the class offers at the level being taken, and its subclass at every level
 * the level brings its features from. A subclass reads
 * its features through the edition's subclass list, so one from the other edition offers
 * nothing here; reading its row by reference is the way out.
 */
function offeringsAt(cls: EntryRef, target: ReturnType<typeof useLevelUpClass>) {
  if (!("name" in cls)) return [];
  const owner = { className: cls.name, classSource: cls.source };
  const row = target.subclassRow;
  const own = featureOfferings(target.after?.features ?? [], owner).filter(
    (offering) => offering.feature.level === target.next,
  );
  if (!row) return own;
  const subclass = featureOfferings(target.subclassAfter?.features ?? [], {
    ...owner,
    subclass: { shortName: row.shortName, source: row.source },
  }).filter(({ feature }) => feature.level >= target.subclassFrom && feature.level <= target.next);
  return [...own, ...subclass];
}
