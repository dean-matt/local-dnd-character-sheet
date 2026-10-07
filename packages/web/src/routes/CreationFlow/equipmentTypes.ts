import type { SearchHit } from "@dnd/catalog";

/**
 * Upstream's `equipmentType` codes, each with what a slot of it is called and the items a
 * search for it offers. `kind` narrows the search to the kinds `/search` knows, and
 * `category` narrows a weapon slot further among them. A focus kind holds every focus, so
 * a druidic focus slot offers an arcane focus too: telling them apart needs upstream's
 * `scfType` on a search hit, which carries none. A tool kind holds every tool, so a gaming
 * set slot offers an artisan's tool too, though a hit's `tool` fact could tell them apart.
 */
const TYPES: Record<string, { label: string; kind: string; category?: "simple" | "martial" }> = {
  weaponSimple: { label: "a simple weapon", kind: "melee,ranged", category: "simple" },
  weaponSimpleMelee: { label: "a simple melee weapon", kind: "melee", category: "simple" },
  weaponMartial: { label: "a martial weapon", kind: "melee,ranged", category: "martial" },
  weaponMartialMelee: { label: "a martial melee weapon", kind: "melee", category: "martial" },
  focusSpellcastingArcane: { label: "an arcane focus", kind: "focus" },
  focusSpellcastingDruidic: { label: "a druidic focus", kind: "focus" },
  focusSpellcastingHoly: { label: "a holy symbol", kind: "focus" },
  instrumentMusical: { label: "a musical instrument", kind: "tool" },
  toolArtisan: { label: "artisan's tools", kind: "tool" },
  setGaming: { label: "a gaming set", kind: "tool" },
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

/** Why `hit` cannot fill a slot of `types`, or `undefined` where it can. */
export function typeMismatch(types: readonly string[], hit: SearchHit): string | undefined {
  const categories = types.map((type) => TYPES[type]?.category);
  if (categories.some((category) => category === undefined)) return undefined;
  return categories.includes(hit.item?.category ?? undefined)
    ? undefined
    : `not ${typeLabel(types)}`;
}
