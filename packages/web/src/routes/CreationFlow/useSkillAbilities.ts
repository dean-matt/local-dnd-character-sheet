import { catalogRowRecordSchema } from "@dnd/catalog";
import { ABILITIES, type Ability, type CharacterDefinition, type ContentRef } from "@dnd/character";
import { useQueries } from "@tanstack/react-query";
import { useCatalogSearch } from "../../hooks/useCatalogSearch.ts";
import { apiGet } from "../../lib/api.ts";
import { retryUnlessClientError } from "../../lib/retryUnlessClientError.ts";
import { CORE_SOURCE } from "./grants.ts";

/**
 * The edition's core skills, each with the ability its row names, so the step can score
 * them before the character exists. A search hit carries no ability, so each row is read
 * once, cached across steps; a row still loading is left out until it arrives.
 */
export function useSkillAbilities(
  edition: CharacterDefinition["edition"],
): { ref: ContentRef; ability: Ability }[] {
  const source = CORE_SOURCE[edition];
  const search = useCatalogSearch({
    edition,
    type: "skill",
    query: "",
    listAll: true,
    limit: 200,
    filters: { source },
  });
  const refs = (search.data?.items ?? []).flatMap((hit) =>
    "source" in hit ? [{ name: hit.name, source: hit.source }] : [],
  );
  const rows = useQueries({
    queries: refs.map((ref) => ({
      queryKey: ["catalog", "skill", ref.name, ref.source],
      queryFn: () =>
        apiGet(
          `/catalog/skill/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.source)}`,
          catalogRowRecordSchema,
        ),
      retry: retryUnlessClientError,
    })),
  });
  return refs.flatMap((ref, index) => {
    const ability = rows[index]?.data?.json.ability;
    return ABILITIES.includes(ability as Ability) ? [{ ref, ability: ability as Ability }] : [];
  });
}
