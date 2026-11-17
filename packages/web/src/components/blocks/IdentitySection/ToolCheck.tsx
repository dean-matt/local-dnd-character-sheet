import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  proficiencyAt,
} from "@dnd/character";
import { useState } from "react";
import { useConditionEffects } from "../../../hooks/useConditionEffects.ts";
import { useToolPrintedAbility } from "../../../hooks/useToolPrintedAbility.ts";
import { rollTerms } from "../../../lib/rollTerms.ts";
import { ModeRoll } from "../../ModeRoll.tsx";
import { signed } from "../signed.ts";

/** Where the edition prints no ability for a tool, a check starts on Intelligence. */
const UNPRINTED: Ability = "int";

type Tool = CharacterRecord["definition"]["proficiencies"]["tools"][number];

export function ToolCheck({
  tool,
  character,
  derived,
}: {
  tool: Tool;
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const { data: printed, isLoading } = useToolPrintedAbility(
    tool.name,
    character.definition.edition,
  );
  const checkExhaustion = useConditionEffects(character.id, character.definition, "check");
  const [picked, setPicked] = useState<Ability>();
  const ability = picked ?? printed ?? UNPRINTED;
  const check = derived.abilityChecks[ability];
  const proficiency = proficiencyAt(derivedValue(derived.proficiencyBonus), tool.level);
  const bonus = derivedValue(check) + proficiency;
  const terms = [
    ...(rollTerms(check) ?? [{ source: "Ability check", value: derivedValue(check) }]),
    ...(proficiency === 0 ? [] : [{ source: "Proficiency", value: proficiency }]),
  ];
  const label = `${tool.name} check`;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
      <span className="min-w-0 flex-1 basis-24 break-words">{tool.name}</span>
      <select
        aria-label={`${tool.name} ability`}
        value={ability}
        onChange={(event) => setPicked(event.target.value as Ability)}
        className="min-h-6 shrink-0 rounded-control border border-border bg-surface text-label"
      >
        {ABILITIES.map((each) => (
          <option key={each} value={each}>
            {ABILITY_LABEL[each]}
          </option>
        ))}
      </select>
      <span className="font-semibold">{signed(bonus)}</span>
      {!isLoading && (
        <ModeRoll
          label={label}
          type="check"
          origin={tool.name}
          bonus={bonus}
          terms={terms}
          effects={checkExhaustion}
        />
      )}
    </li>
  );
}
