/**
 * The kinds of item a search narrows to, each grouping upstream's item `type` codes or one
 * of its flags. Upstream's own codes run to more than forty — a shipping vessel, a trade
 * bar, a gaming set — so a filter offering each would bury the dozen a player looks for.
 */
export const ITEM_KINDS = [
  "melee",
  "ranged",
  "ammunition",
  "light",
  "medium",
  "heavy",
  "shield",
  "potion",
  "scroll",
  "ring",
  "wand",
  "rod",
  "staff",
  "wondrous",
  "focus",
  "gear",
  "tool",
  "treasure",
  "other",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

/** The kind each type code reads as. A code missing here, a mount or a vessel among them, is `other`. */
const KIND_OF_TYPE: Record<string, ItemKind> = {
  M: "melee",
  R: "ranged",
  A: "ammunition",
  AF: "ammunition",
  LA: "light",
  MA: "medium",
  HA: "heavy",
  S: "shield",
  P: "potion",
  SC: "scroll",
  RG: "ring",
  WD: "wand",
  RD: "rod",
  SCF: "focus",
  G: "gear",
  FD: "gear",
  AT: "tool",
  T: "tool",
  GS: "tool",
  INS: "tool",
  $A: "treasure",
  $G: "treasure",
  $C: "treasure",
  TG: "treasure",
  TB: "treasure",
};

/**
 * Every kind an item entry is, read off its `type` — `M|XPHB` reads as `M` — and its
 * `wondrous` and `staff` flags, which upstream states beside a type rather than as one:
 * `Staff of Power` is a melee weapon and a staff, and `Instrument of the Bards` a tool and
 * a wondrous item. An entry none of them place is `other`. The `weapon` and `armor` flags
 * add nothing, since upstream sets them only beside a weapon or armor type code.
 */
export function itemKinds(item: { type?: unknown; wondrous?: unknown; staff?: unknown }) {
  const kinds = new Set<ItemKind>();
  const code = typeof item.type === "string" ? item.type.split("|")[0] : undefined;
  const ofType = code === undefined ? undefined : KIND_OF_TYPE[code];
  if (ofType) kinds.add(ofType);
  if (item.staff) kinds.add("staff");
  if (item.wondrous) kinds.add("wondrous");
  if (kinds.size === 0) kinds.add("other");
  return [...kinds];
}
