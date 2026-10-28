import type { CharacterRecord } from "@dnd/character";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { characterSubtitle } from "../characterSubtitle.ts";

/** The head of the first printed page: name and subtitle, no avatar. */
export function PrintTitle({ character }: { character: CharacterRecord }) {
  const names = useHomebrewNames();
  return (
    <div className="mb-4">
      <p className="font-bold text-[28px] leading-tight">{character.name}</p>
      <p className="text-muted text-sm">{characterSubtitle(character, names)}</p>
    </div>
  );
}
