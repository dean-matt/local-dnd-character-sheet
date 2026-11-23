import type { CharacterDerived } from "./characterDerived.ts";
import { namesPool, resourceLabel, withClassResource } from "./classResources.ts";
import { concentrationStarted } from "./concentration.ts";
import { classResourceKey } from "./keys.ts";
import type { EntryRef } from "./refs.ts";
import { sheetState } from "./rest.ts";
import {
  type CharacterState,
  type Concentration,
  featureUsesSpent,
  withFeatureUse,
} from "./state.ts";

type Sheet = Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources">;

/**
 * How a spell is cast: with a slot of `level`, with the pact slot at its `level`, as a ritual
 * at the spell's own level, as a cantrip at 0, by spending `pool.amount` from a class pool at
 * the spell's own level, or by spending one of the `use.count` casts a feature gives it, keyed
 * `use.key` in the state's `featureUses`, with no slot or, where a pact slot option carries a
 * `use`, with that slot too. `left` counts the slots, the pool's points or the uses left, and
 * is null where the cast spends none or the pool is unlimited.
 */
export type SpellCastOption = {
  via: "slot" | "pact" | "ritual" | "cantrip" | "pool" | "use";
  level: number;
  left: number | null;
  pool?: { class: EntryRef; key: string; amount: number };
  use?: { key: string; count: number; left: number };
};

/**
 * The casts a grantor limits a spell to, by the key of its entry in the state's `featureUses`:
 * each is made without a slot, or with the pact slot where `slot` says so.
 */
type SpellUses = { key: string; count: number; slot?: true };

/**
 * The casts without a slot a spell has: those its grantor gives it, or the uses a held class
 * feature counts that the spell was picked for, such as one of a Warlock's Mystic Arcanum.
 */
export function spellUses(
  spell: {
    uses?: SpellUses;
    pickedFor?: { kind: string; ref: { name: string; source: string } };
  },
  derived: Pick<CharacterDerived, "limitedUses">,
): SpellUses | undefined {
  if (spell.uses) return spell.uses;
  const { pickedFor } = spell;
  if (pickedFor?.kind !== "classFeature") return undefined;
  const held = derived.limitedUses.find(
    ({ feature, origin, part }) =>
      (origin === "class" || origin === "subclass") &&
      !part &&
      feature.name === pickedFor.ref.name &&
      feature.source === pickedFor.ref.source,
  );
  return held && { key: held.key, count: held.count };
}

/** What casting a granted spell spends, such as 2 Ki. */
type SpellCost = { amount: number; resource: string };

/** The cast a granted spell's cost offers: spending that many points of the class pool it names, where the sheet counts one. A sheet with two pools of the same name offers the first only. */
function poolCast(
  spell: { level: number; cost?: SpellCost },
  sheet: CharacterState,
  derived: Sheet,
): SpellCastOption[] {
  const { cost } = spell;
  if (!cost) return [];
  const pool = derived.classResources.find((each) => namesPool(cost.resource, each.key));
  const held =
    pool && sheet.classResources.find((each) => classResourceKey(each) === classResourceKey(pool));
  if (!pool || !held) return [];
  return [
    {
      via: "pool",
      level: spell.level,
      left: held.maximum === null ? null : held.maximum - held.expended,
      pool: { class: pool.class, key: pool.key, amount: cost.amount },
    },
  ];
}

/**
 * Every way `spell` can be cast on the sheet: a cantrip spends nothing; any other spell takes
 * a cast by the feature's uses first where it has `uses`, the feature's own pool cast where it
 * has a `cost` in a pool the sheet counts, then each slot
 * level the sheet shows from its own up, the pact slot where its level reaches the spell's, and
 * a ritual cast where the spell is a ritual, whatever the character's class. An option with
 * none left is listed, so the sheet can refuse it by name.
 */
export function spellCastOptions(
  spell: {
    level: number;
    ritual: boolean;
    granted?: boolean;
    cost?: SpellCost;
    uses?: SpellUses;
  },
  derived: Sheet,
  state: CharacterState,
): SpellCastOption[] {
  if (spell.level === 0) return [{ via: "cantrip", level: 0, left: null }];
  const sheet = sheetState(derived, state);
  const left = (slot: { total: number; expended: number }) => slot.total - slot.expended;
  const slots = sheet.spellSlots
    .filter((slot) => slot.level >= spell.level && slot.total > 0)
    .map((slot): SpellCastOption => ({ via: "slot", level: slot.level, left: left(slot) }));
  const pact = sheet.pactSlots;
  const pactCast: SpellCastOption[] =
    pact && pact.level >= spell.level && pact.total > 0
      ? [{ via: "pact", level: pact.level, left: left(pact) }]
      : [];
  const ritual: SpellCastOption[] = spell.ritual
    ? [{ via: "ritual", level: spell.level, left: null }]
    : [];
  const { uses } = spell;
  const use = uses && {
    key: uses.key,
    count: uses.count,
    left: uses.count - featureUsesSpent(state, uses.key, uses.count),
  };
  if (!uses || !use) return [...poolCast(spell, sheet, derived), ...slots, ...pactCast, ...ritual];
  if (!uses.slot) {
    const free: SpellCastOption = { via: "use", level: spell.level, left: use.left, use };
    return [free, ...poolCast(spell, sheet, derived), ...slots, ...pactCast, ...ritual];
  }
  const limited = pactCast.map((option) => ({ ...option, use }));
  return spell.granted ? limited : [...slots, ...pactCast, ...ritual, ...limited];
}

/**
 * The state after casting `spell` by `option`: the slot spent where `spend` is set, and
 * concentration on the spell at the option's level where `concentrate` is set, with the
 * concentration that ended to make room, or null. Throws a RangeError where a spend finds no
 * slot left.
 */
export function spellCast(
  derived: Sheet,
  state: CharacterState,
  cast: { spell: EntryRef; option: SpellCastOption; spend: boolean; concentrate: boolean },
): { state: CharacterState; ended: Concentration | null } {
  const { option } = cast;
  const spent = cast.spend ? slotSpent(derived, state, option) : state;
  if (!cast.concentrate) return { state: spent, ended: null };
  return concentrationStarted(spent, { spell: cast.spell, level: option.level });
}

/** The state with one slot of `option`, its pool's points or one of its feature's uses spent; a ritual or cantrip spends none. Throws a RangeError where too few are left. */
export function slotSpent(derived: Sheet, state: CharacterState, option: SpellCastOption) {
  if (option.via === "use") return useSpent(state, option);
  const spent = resourceSpent(derived, state, option);
  return option.use ? useSpent(spent, option) : spent;
}

function resourceSpent(derived: Sheet, state: CharacterState, option: SpellCastOption) {
  if (option.via === "ritual" || option.via === "cantrip") return state;
  const sheet = sheetState(derived, state);
  if (option.via === "pool") return poolSpent(sheet, option);
  const slot =
    option.via === "pact"
      ? sheet.pactSlots
      : sheet.spellSlots.find((held) => held.level === option.level);
  if (!slot || slot.expended >= slot.total) {
    throw new RangeError(`no ${option.via} slot of level ${option.level} left`);
  }
  const used = { ...slot, expended: slot.expended + 1 };
  if (option.via === "pact") return { ...state, pactSlots: used };
  const others = state.spellSlots.filter((held) => held.level !== used.level);
  return { ...state, spellSlots: [...others, used].sort((a, b) => a.level - b.level) };
}

function useSpent(state: CharacterState, { use }: SpellCastOption) {
  if (!use) throw new RangeError("no use to cast from");
  const spent = featureUsesSpent(state, use.key, use.count);
  if (spent >= use.count) throw new RangeError("no use left to cast from");
  return withFeatureUse(state, use.key, spent + 1);
}

function poolSpent(sheet: CharacterState, { pool }: SpellCastOption) {
  const held =
    pool && sheet.classResources.find((each) => classResourceKey(each) === classResourceKey(pool));
  if (!pool || !held) throw new RangeError("no pool to cast from");
  if (held.maximum !== null && held.expended + pool.amount > held.maximum) {
    throw new RangeError(`${resourceLabel(pool.key)}: ${pool.amount} needed`);
  }
  return withClassResource(sheet, { ...held, expended: held.expended + pool.amount });
}

/** What a spell prints of its damage: its dice, a cantrip's tiers by character level, and the dice each slot level above its own adds. */
type SpellDamageFacts = {
  level: number;
  damageDice?: string;
  damageTiers?: readonly { level: number; dice: string }[];
  damageUpcast?: string;
};

const POOL = /^(\d+)d(\d+)$/;

/**
 * The notation a cast rolls for damage: a cantrip's tier at `characterLevel`, or the spell's
 * dice plus the upcast step once for each slot level `castLevel` is above the spell's. Undefined
 * where the spell prints no damage dice.
 */
export function spellDamageDice(
  spell: SpellDamageFacts,
  castLevel: number,
  characterLevel: number,
): string | undefined {
  const { damageDice: dice, damageUpcast: step } = spell;
  if (spell.level === 0) {
    const tier = spell.damageTiers?.findLast((each) => each.level <= characterLevel);
    return tier?.dice ?? dice;
  }
  const extra = castLevel - spell.level;
  if (!dice || !step || extra <= 0) return dice;
  const base = POOL.exec(dice);
  const add = POOL.exec(step);
  if (base && add && base[2] === add[2]) {
    return `${Number(base[1]) + Number(add[1]) * extra}d${base[2]}`;
  }
  return dice + `+${step}`.repeat(extra);
}

/** How many beams a cantrip makes at `characterLevel`, or undefined where it makes one. */
export function spellBeams(
  spell: { level: number; beamTiers?: readonly { level: number; count: number }[] },
  characterLevel: number,
): number | undefined {
  if (spell.level !== 0) return undefined;
  return spell.beamTiers?.findLast((each) => each.level <= characterLevel)?.count;
}
