import {
  type CharacterDefinition,
  type ContentRef,
  type EntryRef,
  HIT_DICE,
  type Improvement,
  improvementAt,
  refKey,
  withImprovement,
} from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { useFeatRows } from "../../../hooks/useFeatRows.ts";
import { useImprovementGrants } from "../../../hooks/useImprovementGrants.ts";
import { takenOption, withFeatureChoice } from "../../../lib/featureChoices.ts";
import { type FeatureOffering, featureOfferings } from "../../../lib/featureOfferings.ts";
import { isMade } from "../../../lib/improvementChoice.ts";
import { candidateAt } from "../../../lib/improvementFeats.ts";
import { withPrerequisiteDepartures } from "../../../lib/multiclassPrerequisites.ts";
import { NO_GRANTS, swapGrants } from "../../../lib/proficiencyGrants.ts";
import { setRefValue } from "../../../lib/setRefValue.ts";
import type { HitPointMethod } from "./hitPointPick.ts";
import { featuresAt, tableChanges } from "./levelUpChanges.ts";
import { useLevelUpClass } from "./useLevelUpClass.ts";
import { useLevelUpOptions } from "./useLevelUpOptions.ts";
import { useLevelUpSpells } from "./useLevelUpSpells.ts";
import { useMulticlassEntry } from "./useMulticlassEntry.ts";

type Level = CharacterDefinition["levels"][number];

/**
 * The level the draft holds last, on top of `definition`, read from the level-up form: the
 * choices it asks for, whether each is made, and the edits that make them. A change of
 * class takes back every choice made since, and a change of subclass the options its
 * features offered and the spells and optional features picked, since each read the old
 * one. A level in a class the character does not hold yet also asks for the skill and tool
 * picks its multiclass gains offer, which the draft's proficiencies hold as they are made;
 * `settle` adds what the class grants outright and notes each unmet multiclass
 * prerequisite, just before Apply submits.
 */
export function useLevelUpPlan(
  definition: CharacterDefinition,
  method: HitPointMethod | undefined,
  /** A reopened past level's subclass and stamped spell picks, as saved. */
  saved?: Parameters<typeof useLevelUpSpells>[4],
) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const [
    levels = [],
    feats = [],
    abilityIncreases = [],
    featureChoices = [],
    proficiencies = definition.proficiencies,
    spells = definition.spells,
    optionalFeatures = definition.optionalFeatures,
  ] = useWatch<
    CharacterDefinition,
    [
      "levels",
      "feats",
      "abilityIncreases",
      "featureChoices",
      "proficiencies",
      "spells",
      "optionalFeatures",
    ]
  >({
    name: [
      "levels",
      "feats",
      "abilityIncreases",
      "featureChoices",
      "proficiencies",
      "spells",
      "optionalFeatures",
    ],
  });
  // The schema holds at least one level, which the inferred array type cannot say.
  const level = (levels.at(-1) ?? definition.levels.at(-1)) as Level;
  const target = useLevelUpClass(definition, level.class, level.subclass);
  const entry = useMulticlassEntry(definition, level.class, target.name, target.json);
  const spellPicks = useLevelUpSpells(definition, level.class, target, spells, saved);
  const optionPicks = useLevelUpOptions(definition, level.class, target, optionalFeatures);
  const pickedSkills = (entry.skillPick?.options ?? []).filter((ref) =>
    proficiencies.skills.some((skill) => refKey(skill.ref) === refKey(ref)),
  );
  const pickedTools = entry.toolPicks.map((pick) =>
    pick.options.filter((tool) => proficiencies.tools.some((held) => held.name === tool)),
  );
  const featList = useFeatRows(definition.edition);
  const die = HIT_DICE.find((each) => each === target.hitDie);
  const improvements = useImprovementGrants(levels);
  const grant = improvements.grants.find((each) => each.level === levels.length);
  const draft = { ...definition, levels, feats, abilityIncreases };
  const candidate = grant && candidateAt(draft, grant);
  const improvement = grant && improvementAt(draft, grant.level);
  const featRows = featList.rows;
  const offerings = offeringsAt(level.class, target);
  const chosen = (offering: FeatureOffering) =>
    takenOption(featureChoices, offering.feature, offering.options);

  const dirty = { shouldDirty: true };
  const withLevel = (next: Level) => [...definition.levels, next];
  const restart = () => {
    setValue("feats", definition.feats, dirty);
    setValue("abilityIncreases", definition.abilityIncreases, dirty);
    setValue("featureChoices", definition.featureChoices, dirty);
    setRefValue(setValue, "proficiencies", definition.proficiencies, dirty);
    setValue("departures", definition.departures, dirty);
    setRefValue(setValue, "spells", definition.spells, dirty);
    setRefValue(setValue, "optionalFeatures", definition.optionalFeatures, dirty);
  };

  const picksReady =
    target.read &&
    (!target.asksSubclass || level.subclass !== undefined) &&
    improvements.read &&
    (grant === undefined ||
      (featList.isSuccess && isMade(improvement, featRows, candidate?.totals))) &&
    offerings.every((offering) => chosen(offering) !== undefined) &&
    spellPicks.ready &&
    optionPicks.ready;
  const ready =
    picksReady &&
    die !== undefined &&
    (method === "average" || level.rolled !== undefined) &&
    entry.read &&
    pickedSkills.length === (entry.skillPick?.count ?? 0) &&
    entry.toolPicks.every((pick, index) => pickedTools[index]?.length === pick.count);

  return {
    target,
    die,
    level,
    grant,
    candidate,
    improvement,
    featRows,
    offerings,
    chosen,
    entry,
    pickedSkills,
    pickedTools,
    spellPicks,
    optionPicks,
    /** What an option's prerequisites read: the character with the level and its picks. */
    draft: { levels, spells, optionalFeatures },
    ready,
    /** Whether every pick from the subclass on is made, which is all a reopened past level needs. */
    picksReady,
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
      setRefValue(setValue, "spells", definition.spells, dirty);
      setRefValue(setValue, "optionalFeatures", definition.optionalFeatures, dirty);
    },
    setRolled: (rolled: number | undefined, typed: boolean) => {
      const { rolled: _, typed: __, ...rest } = level;
      const gain = typed ? { rolled, typed: true as const } : { rolled };
      setValue("levels", withLevel(rolled === undefined ? rest : { ...rest, ...gain }), dirty);
    },
    setImprovement: (next: Improvement) => {
      if (!grant) return;
      const held = withImprovement(draft, grant.level, grant.cls, next);
      setValue("feats", held.feats, dirty);
      setValue("abilityIncreases", held.abilityIncreases, dirty);
    },
    toggleSkill: (ref: ContentRef) => {
      const held = pickedSkills.some((each) => refKey(each) === refKey(ref));
      setRefValue(
        setValue,
        "proficiencies",
        {
          ...proficiencies,
          skills: held
            ? proficiencies.skills.filter((skill) => refKey(skill.ref) !== refKey(ref))
            : [...proficiencies.skills, { ref, level: "proficient" }],
        },
        dirty,
      );
    },
    toggleTool: (name: string) => {
      const held = proficiencies.tools.some((tool) => tool.name === name);
      setRefValue(
        setValue,
        "proficiencies",
        {
          ...proficiencies,
          tools: held
            ? proficiencies.tools.filter((tool) => tool.name !== name)
            : [...proficiencies.tools, { name, level: "proficient" }],
        },
        dirty,
      );
    },
    settle: () => {
      if (!entry.entering) return;
      setRefValue(
        setValue,
        "proficiencies",
        swapGrants(getValues("proficiencies"), NO_GRANTS, entry.granted),
        dirty,
      );
      setValue(
        "departures",
        withPrerequisiteDepartures(definition.departures, entry.judged, entry.score),
        dirty,
      );
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
