import type { CharacterDefinition, ContentRef } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { subclassOf } from "./classLevels.ts";
import { useClassCatalog } from "./useClassCatalog.ts";
import { useIdentityCatalog } from "./useIdentityCatalog.ts";

export interface EditionMismatch {
  /** What was chosen, such as `Race`. */
  label: string;
  value: string;
}

const named = (ref: ContentRef) => `${ref.name} (${ref.source})`;

const inList = (rows: readonly ContentRef[], ref: ContentRef) =>
  rows.some((row) => row.name === ref.name && row.source === ref.source);

/**
 * Each choice made so far that the character's edition does not hold: a race or class row
 * of the other edition, or a subrace, background or subclass absent from the edition's
 * list. A choice counts only once its row loads, so one still loading is never named. A
 * homebrew race or background goes unchecked: no hook here reads its edition yet.
 */
export function useEditionMismatches(): EditionMismatch[] {
  const [subrace, background] = useWatch<CharacterDefinition, ["subrace", "background"]>({
    name: ["subrace", "background"],
  });
  const { edition, catalogRace, raceRow, subraces, backgrounds } = useIdentityCatalog();
  const { catalogClass, classRow, homebrew, levels, subclasses } = useClassCatalog();
  const found: EditionMismatch[] = [];

  if (catalogRace && raceRow.data && raceRow.data.edition !== edition)
    found.push({ label: "Race", value: named(catalogRace) });
  if (subrace && subraces.data && !inList(subraces.data.items, subrace))
    found.push({ label: "Subrace", value: named(subrace) });
  if (
    background &&
    "name" in background &&
    backgrounds.data &&
    !inList(backgrounds.data.items, background)
  )
    found.push({ label: "Background", value: named(background) });
  if (catalogClass && classRow.data && classRow.data.edition !== edition)
    found.push({ label: "Class", value: named(catalogClass) });
  if (homebrew.data && homebrew.data.edition !== edition)
    found.push({ label: "Class", value: `${homebrew.data.name} (homebrew)` });
  const subclass = subclassOf(levels);
  if (subclass && subclasses.data && !inList(subclasses.data.items, subclass))
    found.push({ label: "Subclass", value: named(subclass) });
  return found;
}
