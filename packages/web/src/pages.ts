export type CharacterPageSummary = {
  slug: string;
  title: string;
  hidden: boolean;
};

/**
 * Every character gets the same four preset pages, in this fixed order, until a real
 * pages table exists for a character to reorder or hide from. Swap this function for a
 * query against that endpoint once it exists — nothing that reads `getCharacterPages`
 * depends on where the list comes from.
 */
const PRESET_PAGES: readonly CharacterPageSummary[] = [
  { slug: "stats", title: "Stats", hidden: false },
  { slug: "spells", title: "Spells", hidden: false },
  { slug: "inventory", title: "Inventory", hidden: false },
  { slug: "features", title: "Features", hidden: false },
];

export function getCharacterPages(_characterId: string): readonly CharacterPageSummary[] {
  return PRESET_PAGES;
}

export function visiblePages(pages: readonly CharacterPageSummary[]): CharacterPageSummary[] {
  return pages.filter((page) => !page.hidden);
}

export function findCharacterPage(
  characterId: string,
  slug: string,
): CharacterPageSummary | undefined {
  return getCharacterPages(characterId).find((page) => page.slug === slug);
}
