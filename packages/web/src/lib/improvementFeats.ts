import {
  type FeatPrerequisite,
  type FeatRecord,
  featTermsSchema,
  type RacePrerequisite,
} from "@dnd/catalog";
import {
  ABILITIES,
  type Ability,
  abilityScore,
  type CharacterDefinition,
  type ContentRef,
  displayName,
  houseRule,
  IMPROVEMENT_FEAT,
  proficiencyKey,
  refKey,
  withoutImprovement,
} from "@dnd/character";
import type { ImprovementGrant } from "./improvementGrants.ts";

/**
 * The 2024 categories an improvement offers: general, origin and epic boon feats. A
 * fighting style needs the class feature that grants one, and a Dragonmark or a Dark
 * Gift an origin of its own.
 */
const OFFERED_CATEGORIES = ["G", "O", "EB"];

/** What a feat's prerequisites are read against, at the level the improvement arrives. */
export type Candidate = {
  edition: CharacterDefinition["edition"];
  /** Whether the character may take a feat at all, which a classic one may by house rule alone. */
  takesFeats: boolean;
  level: number;
  classNames: readonly string[];
  /**
   * The scores the character had reached at this level, which prerequisites read, and
   * every score bar this improvement's own increases, which an increase may not carry past
   * its cap. Both `undefined` while a base score is unset.
   */
  scores: Record<Ability, number> | undefined;
  totals: Record<Ability, number> | undefined;
  /** The feats the character holds from elsewhere, which a feat that does not repeat leaves out. */
  held: readonly ContentRef[];
  /** The feats held before this level, keyed `name|source` lowercased, which a feat may need. */
  earlier: readonly string[];
  /** The race, and any subrace, lowercased; `undefined` while unset or homebrew, which names none. */
  race: { name: string; subrace?: string } | undefined;
  /** Armor and weapon proficiencies, folded as `proficiencyKey` folds them; `undefined` while unset. */
  armor: readonly string[] | undefined;
  weapons: readonly string[] | undefined;
  /** The class and subclass features held by this level. */
  features: readonly string[];
  /**
   * Whether the character knows any spell. A spell records no level, so one learned after
   * this improvement still counts; recording the level would close that gap.
   */
  knowsSpells: boolean;
};

/**
 * The feats `candidate` may take at an improvement, beside raising scores, which the
 * `Ability Score Improvement` (XPHB) feat stands for and so is not one of them. Scores
 * not yet set refuse no feat.
 */
export function improvementFeats(feats: readonly FeatRecord[], candidate: Candidate): FeatRecord[] {
  if (!candidate.takesFeats) return [];
  const held = new Set(candidate.held.map(refKey));
  return feats.filter((feat) => {
    if (refKey(feat) === refKey(IMPROVEMENT_FEAT)) return false;
    const { category, repeatable, prerequisites } = featTermsSchema.parse(feat.json);
    if (candidate.edition === "one" && !OFFERED_CATEGORIES.includes(category ?? "")) return false;
    if (!repeatable && held.has(refKey(feat))) return false;
    return (
      prerequisites.length === 0 ||
      prerequisites.some((prerequisite) => meets(prerequisite, candidate))
    );
  });
}

/** Whether `candidate` meets one alternative. Anything not yet set refuses nothing. */
function meets(prerequisite: FeatPrerequisite, candidate: Candidate): boolean {
  const { level, className, scores, races, proficiencies, feats, features, spell } = prerequisite;
  const { race, armor, weapons } = candidate;
  const casts = candidate.knowsSpells || ["Spellcasting", "Pact Magic"].some(hasFeature(candidate));
  return (
    (level === undefined || level <= candidate.level) &&
    (className === undefined || candidate.classNames.includes(className)) &&
    (scores.length === 0 ||
      candidate.scores === undefined ||
      scores.some((minimums) =>
        Object.entries(minimums).every(
          ([ability, minimum]) => (candidate.scores?.[ability as Ability] ?? 0) >= minimum,
        ),
      )) &&
    (races.length === 0 || race === undefined || races.some(isRace(race))) &&
    (proficiencies.length === 0 ||
      armor === undefined ||
      weapons === undefined ||
      proficiencies.some(
        (needed) =>
          (needed.armor === undefined || armor.includes(proficiencyKey(needed.armor))) &&
          (needed.weapon === undefined || weapons.includes(proficiencyKey(needed.weapon))),
      )) &&
    (feats.length === 0 || feats.some((feat) => candidate.earlier.includes(feat))) &&
    features.every((group) => group.some(hasFeature(candidate))) &&
    (!spell || casts)
  );
}

const hasFeature = (candidate: Candidate) => (feature: string) =>
  candidate.features.includes(feature);

/**
 * Whether the race a feat names is `race`. A feat names a race by its base name, so
 * `dragonborn` matches `Dragonborn (Chromatic)` (FTD). It names a subrace either beside
 * the race or in its parentheses: `gnome` with `deep` matches `Gnome (Deep)` (DMG), and
 * `vampire (ixalan)` matches `Vampire` with its `Ixalan` subrace.
 */
const isRace =
  (race: { name: string; subrace?: string }) =>
  ({ name, subrace }: RacePrerequisite): boolean => {
    const full = race.subrace ? `${race.name} (${race.subrace})` : race.name;
    const base = full.split(" (")[0];
    const sub = race.subrace ?? /\((.+)\)$/.exec(race.name)?.[1];
    return (name === full || name === base) && (subrace === undefined || subrace === sub);
  };

/** Whether the character may take a feat at an improvement, which a classic one may by house rule alone. */
export const takesFeats = ({
  edition,
  houseRules,
}: Pick<CharacterDefinition, "edition"> & {
  houseRules: CharacterDefinition["houseRules"] | undefined;
}) => edition === "one" || houseRule({ houseRules: houseRules ?? {} }, "feats");

/**
 * The parts of a definition a candidate reads, whose scores, race, proficiencies and spells
 * a creation draft may hold unset.
 */
type Drafted = Pick<CharacterDefinition, "edition" | "levels" | "feats" | "abilityIncreases"> & {
  abilityScores: Partial<Record<Ability, number>> | undefined;
  houseRules: CharacterDefinition["houseRules"] | undefined;
  race?: CharacterDefinition["race"] | undefined;
  subrace?: CharacterDefinition["subrace"];
  proficiencies?: Partial<CharacterDefinition["proficiencies"]> | undefined;
  spells?: CharacterDefinition["spells"] | undefined;
};

/**
 * `definition` as a candidate for the feats at `grant`: its scores and classes as they
 * stood when that level was reached, its choice there set aside.
 */
export function candidateAt(definition: Drafted, grant: ImprovementGrant): Candidate {
  const { feats, abilityIncreases } = withoutImprovement(definition, grant.level);
  const base = definition.abilityScores ?? {};
  const set = ABILITIES.every((ability) => Number.isInteger(base[ability]));
  const scored = (increases: typeof abilityIncreases) =>
    set
      ? (Object.fromEntries(
          ABILITIES.map((ability) => [
            ability,
            abilityScore(
              { abilityScores: base as Record<Ability, number>, abilityIncreases: increases },
              ability,
            ),
          ]),
        ) as Record<Ability, number>)
      : undefined;
  return {
    edition: definition.edition,
    takesFeats: takesFeats(definition),
    level: grant.level,
    classNames: definition.levels.slice(0, grant.level).map((level) => displayName(level.class)),
    scores: scored(abilityIncreases.filter((increase) => (increase.level ?? 0) < grant.level)),
    totals: scored(abilityIncreases),
    held: feats.flatMap(({ ref }) => ("name" in ref ? [ref] : [])),
    earlier: feats.flatMap(({ ref, level }) =>
      "name" in ref && (level ?? 0) < grant.level ? [refKey(ref).toLowerCase()] : [],
    ),
    race: raceOf(definition),
    armor: definition.proficiencies?.armor?.map(proficiencyKey),
    weapons: definition.proficiencies?.weapons?.map(proficiencyKey),
    features: grant.features,
    knowsSpells: (definition.spells?.length ?? 0) > 0,
  };
}

function raceOf({ race, subrace }: Drafted): Candidate["race"] {
  if (race === undefined || !("name" in race)) return undefined;
  return {
    name: race.name.toLowerCase(),
    ...(subrace ? { subrace: subrace.name.toLowerCase() } : {}),
  };
}
