import { classProficiencyGrantsSchema, subclassLevelSchema } from "@dnd/catalog";
import type { CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { useClass } from "../../hooks/useClass.ts";
import { useHomebrewClass } from "../../hooks/useHomebrewClass.ts";
import { useSubclasses } from "../../hooks/useSubclasses.ts";

/**
 * The rows the Class step's choices name: the class the first level takes, from the
 * catalog or from homebrew, and the catalog class's subclasses in the character's edition.
 * `hitDie` and `subclassLevel` are `undefined` until the row they come from loads, and a
 * homebrew class grants no subclass.
 */
export function useClassCatalog() {
  const [edition = "one", levels = []] = useWatch<CharacterDefinition, ["edition", "levels"]>({
    name: ["edition", "levels"],
  });
  const cls = levels[0]?.class;
  const catalogClass = cls && "name" in cls ? cls : undefined;
  const homebrewId = cls && "homebrewId" in cls ? cls.homebrewId : undefined;
  const classRow = useClass(catalogClass);
  const subclasses = useSubclasses(catalogClass, edition);
  const homebrew = useHomebrewClass(homebrewId);
  const json = classRow.data?.json;
  return {
    edition,
    levels,
    cls,
    catalogClass,
    classRow,
    subclasses,
    homebrew,
    hitDie: classRow.data?.hitDie ?? homebrew.data?.hitDie,
    subclassLevel: json && subclassLevelSchema.parse(json),
    grants: json && classProficiencyGrantsSchema.parse(json),
  };
}
