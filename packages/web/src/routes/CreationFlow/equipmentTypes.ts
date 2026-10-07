import type { SearchHit, ToolType } from "@dnd/catalog";

/**
 * Upstream's `equipmentType` codes, each with what a slot of it is called and the items a
 * search for it offers. `kind` narrows the search to the kinds `/search` knows, and
 * `category` narrows a weapon slot further among them, as `tool` does a tool slot. A focus
 * kind holds every focus, so a druidic focus slot offers an arcane focus too: telling them
 * apart needs upstream's `scfType` on a search hit, which carries none.
 */
const TYPES: Record<
  string,
  { label: string; kind: string; category?: "simple" | "martial"; tool?: ToolType }
> = {
  weaponSimple: { label: "a simple weapon", kind: "melee,ranged", category: "simple" },
  weaponSimpleMelee: { label: "a simple melee weapon", kind: "melee", category: "simple" },
  weaponMartial: { label: "a martial weapon", kind: "melee,ranged", category: "martial" },
  weaponMartialMelee: { label: "a martial melee weapon", kind: "melee", category: "martial" },
  focusSpellcastingArcane: { label: "an arcane focus", kind: "focus" },
  focusSpellcastingDruidic: { label: "a druidic focus", kind: "focus" },
  focusSpellcastingHoly: { label: "a holy symbol", kind: "focus" },
  instrumentMusical: { label: "a musical instrument", kind: "tool", tool: "instrument" },
  toolArtisan: { label: "artisan's tools", kind: "tool", tool: "artisan" },
  setGaming: { label: "a gaming set", kind: "tool", tool: "gaming" },
};

/** What a slot of `types` is called, such as `a musical instrument or artisan's tools`. */
export const typeLabel = (types: readonly string[]): string =>
  types.map((type) => TYPES[type]?.label ?? "an item of your choice").join(" or ");

/**
 * The `/search` filter a slot of `types` narrows to, or none where a code is one this does
 * not know. Mundane items only: upstream's `none` rarity, so a martial weapon slot never
 * offers a Sun Blade.
 */
export function typeFilters(types: readonly string[]): Record<string, string> | undefined {
  const known = types.map((type) => TYPES[type]);
  if (known.some((type) => type === undefined)) return undefined;
  return {
    kind: [...new Set(known.flatMap((type) => type?.kind.split(",") ?? []))].join(","),
    rarity: "none",
  };
}

/**
 * Why `hit` cannot fill a slot of `types`, or `undefined` where it can. A slot holding a
 * type with neither a weapon category nor a kind of tool, such as a focus, refuses nothing.
 */
export function typeMismatch(types: readonly string[], hit: SearchHit): string | undefined {
  const fits = types.map((type) => {
    const { category, tool } = TYPES[type] ?? {};
    if (category) return hit.item?.category === category;
    if (tool) return hit.item?.tool === tool;
    return undefined;
  });
  if (fits.includes(undefined)) return undefined;
  return fits.includes(true) ? undefined : `not ${typeLabel(types)}`;
}
