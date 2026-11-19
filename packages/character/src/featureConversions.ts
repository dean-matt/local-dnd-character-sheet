/**
 * The trades between a class pool and spell slots that held features make, read from their
 * recorded `convert` mechanics, and the state each trade leaves.
 */
import type { CharacterDerived } from "./characterDerived.ts";
import { resourceLabel, withClassResource } from "./classResources.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { entryKey } from "./keys.ts";
import { sheetState } from "./rest.ts";
import type { CharacterState } from "./state.ts";

type Conversion = CharacterDerived["featureConversions"][number];

type Sheet = Pick<CharacterDerived, "hitDice" | "spellSlots" | "pactSlots" | "classResources">;

/** Each held class feature's conversions, its costs cut at half `proficiency`, rounded up, where it says so. */
export function featureConversions(definition: HoldsFeatures, proficiency: number): Conversion[] {
  return heldFeatures(definition).flatMap(({ entry, ref }) => {
    if (!("className" in entry.ref)) return [];
    const owner = { name: entry.ref.className, source: entry.ref.classSource };
    return mechanicsOfKind(entry, "convert").map(({ pool, costs, upTo, refund }) => ({
      feature: ref,
      class: owner,
      pool,
      costs: upTo ? costs.slice(0, Math.ceil(proficiency / 2)) : costs,
      refund: refund === true,
    }));
  });
}

/**
 * One trade a conversion offers: `create` regains an expended slot of `level` for `points`
 * from the pool, `refund` expends one for `points`, its level capped at what the pool has
 * spent. `points` is null where the sheet counts no such pool, as a 2014 cleric's table prints
 * no Channel Divinity column, so the trade costs nothing from it. `refused` says why it cannot
 * go, or is null.
 */
export type ConversionOption = {
  via: "create" | "refund";
  level: number;
  points: number | null;
  refused: string | null;
};

/** The conversion's pool as the sheet shows it, the feature's own class's where two classes hold one; undefined where the sheet counts none. */
function heldPool(derived: Sheet, sheet: CharacterState, conversion: Conversion) {
  const candidates = derived.classResources
    .map((pool, index) => ({ pool, index }))
    .filter(({ pool }) => pool.key === conversion.pool);
  const picked =
    candidates.find(({ pool }) => entryKey(pool.class) === entryKey(conversion.class)) ??
    candidates[0];
  const held = picked && sheet.classResources[picked.index];
  return held?.maximum == null ? undefined : { ...held, maximum: held.maximum };
}

/**
 * Every trade `conversion` offers at each slot level the sheet shows, each creation before each
 * refund. A refund needs a pool the sheet counts. A slot pact magic gives is never traded.
 */
export function conversionOptions(
  derived: Sheet,
  state: CharacterState,
  conversion: Conversion,
): ConversionOption[] {
  const sheet = sheetState(derived, state);
  const pool = heldPool(derived, sheet, conversion);
  const left = pool && pool.maximum - pool.expended;
  const slots = sheet.spellSlots.filter((slot) => slot.total > 0);
  const create = slots.flatMap((slot): ConversionOption[] => {
    const cost = conversion.costs[slot.level - 1];
    if (cost === undefined) return [];
    const refused =
      left !== undefined && left < cost
        ? `${resourceLabel(conversion.pool)}: ${left} left, ${cost} needed.`
        : slot.expended === 0
          ? `No level ${slot.level} slot is expended.`
          : null;
    return [{ via: "create", level: slot.level, points: pool ? cost : null, refused }];
  });
  const refund =
    conversion.refund && pool
      ? slots.map(
          (slot): ConversionOption => ({
            via: "refund",
            level: slot.level,
            points: Math.min(slot.level, pool.expended),
            refused: slot.expended >= slot.total ? `No level ${slot.level} slot left.` : null,
          }),
        )
      : [];
  return [...create, ...refund];
}

/**
 * The state after one trade of `conversion`, the pool, where the sheet counts it, and the slot
 * changed together. Throws a RangeError where `conversionOptions` offers no such trade or
 * refuses it.
 */
export function convertedState(
  derived: Sheet,
  state: CharacterState,
  conversion: Conversion,
  trade: Pick<ConversionOption, "via" | "level">,
): CharacterState {
  const option = conversionOptions(derived, state, conversion).find(
    (each) => each.via === trade.via && each.level === trade.level,
  );
  if (!option) throw new RangeError(`no level ${trade.level} slot to ${trade.via}`);
  if (option.refused) throw new RangeError(option.refused);
  const sheet = sheetState(derived, state);
  const pool = heldPool(derived, sheet, conversion);
  const slot = sheet.spellSlots.find((held) => held.level === trade.level);
  if (!slot) throw new RangeError(`no level ${trade.level} slot to ${trade.via}`);
  const creates = trade.via === "create";
  const points = option.points ?? 0;
  const paid = pool
    ? withClassResource(state, {
        ...pool,
        expended: pool.expended + (creates ? points : -points),
      })
    : state;
  const traded = { ...slot, expended: slot.expended + (creates ? -1 : 1) };
  const others = paid.spellSlots.filter((held) => held.level !== traded.level);
  return { ...paid, spellSlots: [...others, traded].sort((a, b) => a.level - b.level) };
}
