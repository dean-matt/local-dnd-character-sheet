import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useClass } from "../../hooks/useClass.ts";
import { useHomebrewClass } from "../../hooks/useHomebrewClass.ts";
import { useSubclasses } from "../../hooks/useSubclasses.ts";

/**
 * The rows the first class reads, for what a character takes from that class alone — its
 * starting equipment and its starting spells: the class, from the catalog or from homebrew,
 * and the catalog class's subclasses in the character's edition. `useClassEntries` reads
 * every class.
 */
export function useClassCatalog() {
  const [edition = "one", levels = []] = useWatch<CharacterDefinition, ["edition", "levels"]>({
    name: ["edition", "levels"],
  });
  const cls = levels[0]?.class;
  const catalogClass = cls && "name" in cls ? cls : undefined;
  const homebrewId = cls && "homebrewId" in cls ? cls.homebrewId : undefined;
  return {
    levels,
    cls,
    catalogClass,
    classRow: useClass(catalogClass),
    subclasses: useSubclasses(catalogClass, edition),
    homebrew: useHomebrewClass(homebrewId),
  };
}
