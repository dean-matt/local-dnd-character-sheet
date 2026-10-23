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
  SenseGrant,
} from "./catalog.ts";
import type { CharacterDerived, FeatGrants } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { entryKey, itemKey, refKey } from "./keys.ts";
import type { Ability, ContentRef } from "./refs.ts";
import { derivedValue } from "./resolve.ts";

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

export type FeatPick = { field: FeatPickField; name: string };

/**
 * The picks each of `offers` takes from `picks`: each offer, in order, takes up to its count
 * of the names stored under its fields that it offers. A pick no offer takes grants nothing.
 * An offer of any tool of a kind takes any tool name, since the kind a tool is lives in its
 * item row and not here; only the sheet's control holds a pick to the kind. Carrying the
 * kinds on the offer and the tool rows on the catalog is the way out. Two offers sharing a
 * field read its names in offer order, so a name stored for the later one fills the earlier
 * first; no feat at the pinned tag offers two such picks, and keying a pick by its offer is
 * the way out.
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

/** What one feat or item names for skills; `picked*` holds the player's picks, which an item has none of. */
type SkillSource = {
  name: string;
  skills: readonly string[];
  expertise: readonly string[];
  pickedSkills: readonly string[];
  pickedExpertise: readonly string[];
};

/**
 * The skills `own` raise, each at the highest level they raise it to. Expertise lands only
 * on a skill the character is proficient in, whether the definition, `own` or `other` gave
 * the proficiency. A source that names one skill under both its proficiency and its
 * expertise, as `Aberrant Anatomy` (RHW) names Perception, grants expertise only where
 * something else already gave the proficiency.
 */
function grantedSkills(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
  own: readonly SkillSource[],
  other: readonly SkillSource[],
): FeatGrants["skills"] {
  const rows = new Map(catalog.skills.map(({ ref }) => [ref.name.toLowerCase(), ref]));
  const stored = new Set(
    definition.proficiencies.skills
      .filter((skill) => rank(skill.level) >= rank("proficient"))
      .map((skill) => skill.ref.name.toLowerCase()),
  );
  const proficient = (name: string, besides?: SkillSource) =>
    stored.has(name) ||
    [...own, ...other].some(
      (source) =>
        (source !== besides && source.skills.includes(name)) || source.pickedSkills.includes(name),
    );
  const granted = new Map<string, SkillGrant>();
  for (const source of own) {
    for (const name of [...source.skills, ...source.pickedSkills]) {
      raiseSkill(granted, rows.get(name), "proficient", source.name);
    }
  }
  const expertise = own.flatMap((source) => [
    ...source.pickedExpertise.map((name) => ({ name, source, besides: undefined })),
    ...source.expertise.map((name) => ({
      name,
      source,
      besides: source.skills.includes(name) ? source : undefined,
    })),
  ]);
  for (const { name, source, besides } of expertise) {
    if (proficient(name, besides)) raiseSkill(granted, rows.get(name), "expertise", source.name);
  }
  return [...granted.values()].map(({ ref, level, from }) => ({
    ref,
    level: level === "expertise" ? "expertise" : "proficient",
    from,
  }));
}

const featSource = ({ trait, picked }: Held): SkillSource => ({
  name: trait.name,
  skills: trait.skills,
  expertise: trait.expertise,
  pickedSkills: picked.skills,
  pickedExpertise: picked.expertise,
});

/** The items worn, attuned where they must be, that name a skill. */
function wornSkillSources(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): SkillSource[] {
  return definition.inventory.flatMap((entry) => {
    const item = catalog.itemSkills.get(itemKey(entry));
    return item && entry.equipped && (entry.attuned || !item.requiresAttunement)
      ? [{ ...item, pickedSkills: [], pickedExpertise: [] }]
      : [];
  });
}

/**
 * What every feat the definition holds grants, and its resistances and immunities as a
 * defense grant each and its senses, cited by the feat's name. A feat no row answers grants
 * nothing. `itemSkills` holds the skills the worn items raise, kept apart so the sheet can
 * say which source granted what.
 */
export function featGrants(
  definition: CharacterDefinition,
  catalog: CharacterCatalog,
): {
  granted: FeatGrants;
  defenses: (DefenseTrait & { from: string })[];
  senses: (SenseGrant & { from: string })[];
  itemSkills: FeatGrants["skills"];
} {
  const held = definition.feats.flatMap(({ ref, picks }): Held[] => {
    const trait = catalog.featGrants.get(entryKey(ref));
    return trait ? [{ trait, picked: acceptedPicks(trait.offers, picks) }] : [];
  });
  const feats = held.map(featSource);
  const items = wornSkillSources(definition, catalog);
  const named = (field: "tools" | "languages") =>
    gathered(held, ({ trait, picked }) => [...trait[field], ...picked[field]]);
  return {
    granted: {
      savingThrows: gathered(held, ({ trait, picked }) => [
        ...trait.savingThrows,
        ...picked.savingThrows,
      ]).flatMap(({ name, from }) => (isAbility(name) ? [{ name, from }] : [])),
      skills: grantedSkills(definition, catalog, feats, items),
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
    senses: held.flatMap(({ trait }) =>
      trait.senses.map((sense) => ({ ...sense, from: trait.name })),
    ),
    itemSkills: grantedSkills(definition, catalog, items, feats),
  };
}

/**
 * A skill's level from what the character stores and what feats grant: the higher of the
 * two, except that expertise stored `onGrant` counts only while a feat grants the skill.
 */
export function heldSkillLevel(
  stored: { level: ProficiencyLevel; onGrant?: true } | undefined,
  granted: ProficiencyLevel = "none",
): ProficiencyLevel {
  const own = stored?.onGrant && granted === "none" ? "none" : (stored?.level ?? "none");
  return rank(granted) > rank(own) ? granted : own;
}

/** The level each skill (by `refKey`) is granted at by feats and worn items, the higher where both grant it. */
export function grantedSkillLevels(derived: CharacterDerived): Map<string, ProficiencyLevel> {
  const levels = new Map<string, ProficiencyLevel>();
  const skills = [
    ...derivedValue(derived.featGrants).skills,
    ...derivedValue(derived.itemGrants).skills,
  ];
  for (const { ref, level } of skills)
    levels.set(refKey(ref), heldSkillLevel({ level }, levels.get(refKey(ref))));
  return levels;
}

/**
 * `definition` with what feats grant, and the skills worn items raise, added to the
 * proficiencies the sheet computes from: saving throws, skills at the highest of the stored
 * and granted levels, armor and weapons.
 */
export function withFeatGrants(
  definition: CharacterDefinition,
  granted: FeatGrants,
  itemSkills: FeatGrants["skills"],
): CharacterDefinition {
  const { proficiencies } = definition;
  const grants = new Map<string, FeatGrants["skills"][number]>();
  for (const skill of [...granted.skills, ...itemSkills]) {
    const held = grants.get(refKey(skill.ref));
    if (!held || rank(skill.level) > rank(held.level)) grants.set(refKey(skill.ref), skill);
  }
  const skills = new Map<string, { ref: ContentRef; level: ProficiencyLevel }>();
  for (const skill of [...proficiencies.skills, ...grants.values()]) {
    const key = refKey(skill.ref);
    const stored = proficiencies.skills.find((held) => refKey(held.ref) === key);
    const level = heldSkillLevel(stored, grants.get(key)?.level);
    if (level !== "none") skills.set(key, { ref: skill.ref, level });
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
