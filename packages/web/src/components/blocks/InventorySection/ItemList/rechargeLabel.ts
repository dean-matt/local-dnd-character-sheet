import type { ItemCharges } from "@dnd/catalog";

const LABEL = {
  dawn: "recharges at dawn",
  dusk: "recharges at dusk",
  midnight: "recharges at midnight",
  restLong: "recharges on a long rest",
  special: "recharges by a special rule, never by a rest",
} as const;

/** When the item recharges, as the sheet states it. */
export const rechargeLabel = (recharge: NonNullable<ItemCharges["recharge"]>): string =>
  LABEL[recharge];
