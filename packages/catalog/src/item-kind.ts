import { z } from "zod";

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

/** Whether an item of `kinds` is one `wanted` admits; every item is where it names none. */
export function ofWantedKind(kinds: readonly ItemKind[], wanted?: readonly string[]) {
  return !wanted?.length || kinds.some((kind) => wanted.includes(kind));
}

/**
 * The kinds of tool a pick can ask for, each one of upstream's tool type codes, so a pick
 * of any artisan's tool never offers a lute. `other` is a tool of none of them, such as
 * thieves' tools.
 */
const TOOL_TYPES = ["artisan", "instrument", "gaming", "other"] as const;

export type ToolType = (typeof TOOL_TYPES)[number];

const TOOL_OF_TYPE: Record<string, ToolType> = {
  AT: "artisan",
  INS: "instrument",
  GS: "gaming",
  T: "other",
};

/**
 * What a search hit says of an item beyond its name: its kinds, its rarity, whether a
 * weapon is simple or martial, and which kind of tool a tool is. A row with none of
 * `rarity` or `category` carries `null` for it; `tool` is absent from every row but a tool.
 */
export const itemHitFactsSchema = z.strictObject({
  kinds: z.array(z.enum(ITEM_KINDS)).min(1),
  rarity: z.string().min(1).nullable(),
  category: z.enum(["simple", "martial"]).nullable(),
  tool: z.enum(TOOL_TYPES).optional(),
});

export type ItemHitFacts = z.infer<typeof itemHitFactsSchema>;

/** An item entry's hit facts, read off the same fields `itemKinds` reads and two more. */
export function itemHitFacts(item: {
  type?: unknown;
  wondrous?: unknown;
  staff?: unknown;
  rarity?: unknown;
  weaponCategory?: unknown;
}): ItemHitFacts {
  const { rarity, weaponCategory } = item;
  const code = typeof item.type === "string" ? item.type.split("|")[0] : undefined;
  const tool = code === undefined ? undefined : TOOL_OF_TYPE[code];
  return {
    kinds: itemKinds(item),
    rarity: typeof rarity === "string" && rarity !== "" ? rarity : null,
    category: weaponCategory === "simple" || weaponCategory === "martial" ? weaponCategory : null,
    ...(tool && { tool }),
  };
}
