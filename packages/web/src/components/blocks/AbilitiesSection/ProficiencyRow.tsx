import { ABILITY_LABEL, type Ability, type Derived, type RollEffectEntry } from "@dnd/character";
import { X } from "lucide-react";
import type { Rules } from "./abilityRules.ts";
import { DerivedBonus } from "./DerivedBonus.tsx";
import { DetailName } from "./DetailName/DetailName.tsx";
import { ProficiencyRing } from "./ProficiencyRing.tsx";
import { PROFICIENCY_MARK, type ProficiencyLevel } from "./proficiencyMark.ts";
import { RollEffects } from "./RollEffects.tsx";

/** One row of a proficiency list: the ring a reader checks as often as the total, then the total. */
export function ProficiencyRow({
  level,
  name,
  label,
  ability,
  modifier,
  title,
  rules,
  effects = [],
  onCycleLevel,
  onRemove,
}: {
  level: ProficiencyLevel;
  name: string;
  label?: string;
  ability?: Ability;
  modifier: Derived<number>;
  title: string;
  rules: Rules | undefined;
  /** What equipped items grant on this roll. */
  effects?: readonly RollEffectEntry[];
  /** Makes the ring a button that moves to the next level, for a row the character owns. */
  onCycleLevel?: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-0.5 text-body">
      {onCycleLevel ? (
        <button
          type="button"
          aria-label={`${name} proficiency: ${PROFICIENCY_MARK[level].text}`}
          onClick={onCycleLevel}
          className="flex"
        >
          <ProficiencyRing level={level} />
        </button>
      ) : (
        <ProficiencyRing level={level} />
      )}
      <span className="flex-1">
        <DetailName
          title={title}
          meta={PROFICIENCY_MARK[level].text}
          value={modifier}
          rules={rules}
          className="hover:underline"
        >
          {label ? (
            <>
              <span aria-hidden="true">{label}</span>
              <span className="sr-only">{name}</span>
            </>
          ) : (
            name
          )}
        </DetailName>
        {level !== "none" && (
          <span className="sr-only">, {PROFICIENCY_MARK[level].text.toLowerCase()}</span>
        )}
      </span>
      {ability && (
        <span className="w-6.5 text-label text-muted uppercase">
          <span aria-hidden="true">{ability}</span>
          <span className="sr-only">{ABILITY_LABEL[ability]}</span>
        </span>
      )}
      <span className="flex w-7 justify-end font-semibold">
        <DerivedBonus named name={ability ? `${name} check` : `${name} save`} value={modifier} />
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="text-muted hover:text-ink"
        >
          <X aria-hidden="true" size={10} strokeWidth={2} />
        </button>
      )}
      <RollEffects effects={effects} className="basis-full pl-6" />
    </li>
  );
}
