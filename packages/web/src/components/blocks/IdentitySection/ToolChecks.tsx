import { itemRecordSchema, toolAbility } from "@dnd/catalog";
import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  proficiencyAt,
} from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { apiGet } from "../../../lib/api.ts";
import { ModeRoll } from "../../ModeRoll.tsx";
import { signed } from "../signed.ts";

/** Where the edition prints no ability for a tool, a check starts on Intelligence. */
const UNPRINTED: Ability = "int";

type Tool = CharacterRecord["definition"]["proficiencies"]["tools"][number];

/** The ability the 2024 book prints for a tool, if the catalog holds a row of that name. */
function usePrintedAbility(name: string, edition: CharacterRecord["edition"]) {
  return useQuery({
    queryKey: ["catalog", "toolAbility", name],
    queryFn: async () => {
      const row = await apiGet(`/items/${encodeURIComponent(name)}/XPHB`, itemRecordSchema).catch(
        () => undefined,
      );
      return row ? (toolAbility(row.json) ?? null) : null;
    },
    enabled: edition === "one",
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}

function ToolCheck({
  tool,
  character,
  derived,
}: {
  tool: Tool;
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const printed = usePrintedAbility(tool.name, character.definition.edition);
  const [picked, setPicked] = useState<Ability>();
  const ability = picked ?? printed ?? UNPRINTED;
  const bonus =
    derivedValue(derived.abilityModifiers[ability]) +
    proficiencyAt(derivedValue(derived.proficiencyBonus), tool.level);
  const label = `${tool.name} check`;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
      <span className="min-w-0 flex-1">{tool.name}</span>
      <select
        aria-label={`${tool.name} ability`}
        value={ability}
        onChange={(event) => setPicked(event.target.value as Ability)}
        className="min-h-6 rounded-control border border-border bg-surface text-label"
      >
        {ABILITIES.map((each) => (
          <option key={each} value={each}>
            {ABILITY_LABEL[each]}
          </option>
        ))}
      </select>
      <span className="font-semibold">{signed(bonus)}</span>
      <ModeRoll label={label} type="check" origin={tool.name} bonus={bonus} />
    </li>
  );
}

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
