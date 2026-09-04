/**
 * What a resource recovers on, and how an item's upstream `recharge` maps onto it.
 */

/**
 * What a resource recovers on. The vocabulary is a rule rather than a storage
 * detail, so it lives here and the character schema validates against it.
 */
export const RESET_TRIGGERS = ["short", "long", "dawn", "manual"] as const;

export type ResetTrigger = (typeof RESET_TRIGGERS)[number];

/**
 * Upstream `recharge` values that map onto a trigger the sheet tracks. `dusk`,
 * `midnight` and `special` do not, so they degrade to `manual` rather than
 * widening the four triggers a character's resources are stored with.
 */
const RECHARGE_TRIGGERS: Record<string, ResetTrigger> = {
  restShort: "short",
  restLong: "long",
  dawn: "dawn",
};

export function resetsOn(recharge: string | null | undefined): ResetTrigger {
  if (!recharge) {
    return "manual";
  }
  return RECHARGE_TRIGGERS[recharge] ?? "manual";
}
