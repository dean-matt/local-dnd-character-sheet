import type { SearchHit } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { useCatalogSearch } from "../../../hooks/useCatalogSearch.ts";

// Above every class one edition and the homebrew hold together; past it, the classes
// beyond go unoffered until this pages.
const CLASS_LIMIT = 200;

/**
 * Every class the edition and the homebrew offer, and each one's name as a pick lists it:
 * with its source, or `homebrew`, where another class shares the name.
 */
export function useClassList(edition: CharacterDefinition["edition"]) {
  const classes = useCatalogSearch({
    edition,
    type: "class",
    query: "",
    limit: CLASS_LIMIT,
    listAll: true,
  });
  const hits = classes.data?.items ?? [];
  const names = hits.map((hit) => hit.name);
  const shared = new Set(names.filter((name, index) => names.indexOf(name) !== index));
  return {
    hits,
    failed: classes.isError,
    label: (hit: SearchHit) =>
      shared.has(hit.name) ? `${hit.name} (${"id" in hit ? "homebrew" : hit.source})` : hit.name,
  };
}
