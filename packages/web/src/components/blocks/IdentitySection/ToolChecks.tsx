import type { CharacterRecord } from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { ToolCheck } from "./ToolCheck.tsx";

/**
 * A check for each tool the character holds at any level, rolled on the ability the player
 * picks, which starts on the one the character's edition prints for the tool. Proficiency
 * scales with the level, so expertise doubles it.
 */
export function ToolChecks({ character }: { character: CharacterRecord }) {
  const { data: derived } = useCharacterDerived(character.id);
  const held = character.definition.proficiencies.tools.filter(({ level }) => level !== "none");
  if (!derived || held.length === 0) return null;
  return (
    <ul aria-label="Tool checks" className="flex flex-col gap-1">
      {held.map((tool) => (
        <ToolCheck key={tool.name} tool={tool} character={character} derived={derived} />
      ))}
    </ul>
  );
}
