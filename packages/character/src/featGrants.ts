/**
 * What the character's feats grant through the fields races and items carry, read from each
 * `feats` entry's row and its picks. The definition stores none of it, so removing a feat
 * takes back exactly what it granted and nothing the race or the player gave as well.
 */
import { ABILITIES, PROFICIENCY_LEVELS, type ProficiencyLevel } from "@dnd/rules";
import type {
  CharacterCatalog,
  DefenseTrait,
  FeatGrantTrait,
  FeatOffer,
  FeatPickField,
} from "./catalog.ts";
import type { FeatGrants } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { entryKey, refKey } from "./keys.ts";
import type { Ability, ContentRef } from "./refs.ts";

type Picks = CharacterDefinition["feats"][number]["picks"];
type Picked = Record<FeatPickField, string[]>;

const FIELDS: readonly FeatPickField[] = [
  "savingThrows",
  "skills",
  "expertise",
  "tools",
  "languages",
  "resist",
];

/** One pick an offer took: the field it lands in, and the name. */
export type FeatPick = { field: FeatPickField; name: string };

/**
 * The picks each of `offers` takes from `picks`: each offer, in order, takes up to its count
 * of the names stored under its fields that it offers. A pick no offer takes grants nothing.
 * An offer of any tool of a kind takes any tool name, since the kind a tool is lives in its
 * item row and not here; only the sheet's control holds a pick to the kind. Carrying the
 * kinds on the offer and the tool rows on the catalog is the way out.
 */
export function allocatePicks(offers: readonly FeatOffer[], picks: Picks): FeatPick[][] {
  const left = new Map(FIELDS.map((field) => [field, [...(picks?.[field] ?? [])]]));
  return offers.map((offer) => {
    const taken: FeatPick[] = [];
    for (const field of offer.fields) {
      left.set(
        field,
        (left.get(field) ?? []).filter((name) => {
          if (taken.length === offer.count) return true;
          if (offer.from !== null && !offer.from.includes(name)) return true;
          taken.push({ field, name });
          return false;
        }),
      );
    }
    return taken;
  });
}

function acceptedPicks(offers: readonly FeatOffer[], picks: Picks): Picked {
  const accepted = Object.fromEntries(FIELDS.map((field) => [field, [] as string[]])) as Picked;
  for (const { field, name } of allocatePicks(offers, picks).flat()) accepted[field].push(name);
  return accepted;
}

type Held = { trait: FeatGrantTrait; picked: Picked };

/** Each name once, in the order first granted, with every feat that grants it. */
function gathered(held: readonly Held[], names: (feat: Held) => readonly string[]) {
  const from = new Map<string, string[]>();
  for (const feat of held) {
    for (const name of names(feat)) {
      const labels = from.get(name) ?? [];
      if (!labels.includes(feat.trait.name)) labels.push(feat.trait.name);
      from.set(name, labels);
    }
  }
  return [...from].map(([name, labels]) => ({ name, from: labels }));
}

const isAbility = (name: string): name is Ability =>
  (ABILITIES as readonly string[]).includes(name);

const rank = (level: ProficiencyLevel) => PROFICIENCY_LEVELS.indexOf(level);

type SkillGrant = { ref: ContentRef; level: ProficiencyLevel; from: string[] };

function raiseSkill(
  granted: Map<string, SkillGrant>,
  ref: ContentRef | undefined,
  level: ProficiencyLevel,
  from: string,
): void {
  if (!ref) return;
  const entry = granted.get(refKey(ref)) ?? { ref, level, from: [] };
  if (rank(level) > rank(entry.level)) entry.level = level;
  if (!entry.from.includes(from)) entry.from.push(from);
  granted.set(refKey(ref), entry);
}

/**
 * The skills feats raise, each at the highest level they raise it to. Expertise lands only
 * on a skill the character is proficient in. A feat that names one skill under both its
 * proficiency and its expertise, as `Aberrant Anatomy` (RHW) names Perception, grants
 * expertise only where something else already gave the proficiency.
 */
function grantedSkills(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  held: readonly Held[],
): FeatGrants["skills"] {
  const rows = new Map(catalog.skills.map(({ ref }) => [ref.name.toLowerCase(), ref]));
  const stored = new Set(
    definition.proficiencies.skills
      .filter((skill) => rank(skill.level) >= rank("proficient"))
      .map((skill) => skill.ref.name.toLowerCase()),
  );
  const proficient = (name: string, besides?: Held) =>
    stored.has(name) ||
    held.some(
      (feat) =>
        (feat !== besides && feat.trait.skills.includes(name)) || feat.picked.skills.includes(name),
    );
  const granted = new Map<string, SkillGrant>();
  for (const { trait, picked } of held) {
    for (const name of [...trait.skills, ...picked.skills]) {
      raiseSkill(granted, rows.get(name), "proficient", trait.name);
    }
  }
  const expertise = held.flatMap((feat) => [
    ...feat.picked.expertise.map((name) => ({ name, feat, besides: undefined })),
    ...feat.trait.expertise.map((name) => ({
      name,
      feat,
      besides: feat.trait.skills.includes(name) ? feat : undefined,
    })),
  ]);
  for (const { name, feat, besides } of expertise) {
    if (proficient(name, besides))
      raiseSkill(granted, rows.get(name), "expertise", feat.trait.name);
  }
  return [...granted.values()].map(({ ref, level, from }) => ({
    ref,
    level: level === "expertise" ? "expertise" : "proficient",
    from,
  }));
}

/**
 * What every feat the definition holds grants, and its resistances and immunities as a
 * defense grant each, cited by the feat's name. A feat no row answers grants nothing.
 */
export function featGrants(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): { granted: FeatGrants; defenses: (DefenseTrait & { from: string })[] } {
  const held = definition.feats.flatMap(({ ref, picks }): Held[] => {
    const trait = catalog.featGrants.get(entryKey(ref));
    return trait ? [{ trait, picked: acceptedPicks(trait.offers, picks) }] : [];
  });
  const named = (field: "tools" | "languages") =>
    gathered(held, ({ trait, picked }) => [...trait[field], ...picked[field]]);
  return {
    granted: {
      savingThrows: gathered(held, ({ trait, picked }) => [
        ...trait.savingThrows,
        ...picked.savingThrows,
      ]).flatMap(({ name, from }) => (isAbility(name) ? [{ name, from }] : [])),
      skills: grantedSkills(definition, catalog, held),
      tools: named("tools"),
      languages: named("languages"),
      armor: gathered(held, ({ trait }) => trait.armor),
      weapons: gathered(held, ({ trait }) => trait.weapons),
    },
    defenses: held.map(({ trait, picked }) => ({
      resist: [...trait.resist, ...picked.resist],
      immune: trait.immune,
      conditionImmune: trait.conditionImmune,
      vulnerable: [],
      from: trait.name,
    })),
  };
}

/**
 * `definition` with what feats grant added to the proficiencies the sheet computes from:
 * saving throws, skills at the higher of the stored and granted level, armor and weapons.
 */
export function withFeatGrants(
  definition: CharacterDefinition,
  granted: FeatGrants,
): CharacterDefinition {
  const { proficiencies } = definition;
  const skills = new Map(proficiencies.skills.map((skill) => [refKey(skill.ref), skill]));
  for (const { ref, level } of granted.skills) {
    const held = skills.get(refKey(ref));
    if (!held || rank(level) > rank(held.level)) skills.set(refKey(ref), { ref, level });
  }
  const names = (list: readonly string[], more: readonly { name: string }[]) => [
    ...list,
    ...more.map(({ name }) => name),
  ];
  return {
    ...definition,
    proficiencies: {
      ...proficiencies,
      savingThrows: [
        ...new Set([
          ...proficiencies.savingThrows,
          ...granted.savingThrows.map(({ name }) => name),
        ]),
      ],
      skills: [...skills.values()],
      armor: names(proficiencies.armor, granted.armor),
      weapons: names(proficiencies.weapons, granted.weapons),
    },
  };
}
