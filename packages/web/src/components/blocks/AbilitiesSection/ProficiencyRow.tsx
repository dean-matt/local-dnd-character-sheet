import { ABILITY_LABEL, type Ability, type Derived, type RollEffectEntry } from "@dnd/character";
import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Popover } from "../../Popover.tsx";
import { DerivedValue } from "../DerivedValue.tsx";
import type { Rules } from "./abilityRules.ts";
import { DetailName } from "./DetailName/DetailName.tsx";
import { ProficiencyRing } from "./ProficiencyRing.tsx";
import { PROFICIENCY_MARK, type ProficiencyLevel } from "./proficiencyMark.ts";
import { RollEffectChip } from "./RollEffectChip.tsx";

/**
 * One row of a proficiency list: the ring a reader checks as often as the total, the name
 * and what it rolls on, then the chip and the total in a column every row shares.
 */
export function ProficiencyRow({
  level,
  name,
  label,
  ability,
  modifier,
  title,
  rules,
  effects = [],
  overrideKey,
  onCycleLevel,
  homebrew = false,
  detailFooter,
}: {
  level: ProficiencyLevel;
  name: string;
  label?: string;
  /** A check's ability, or `flat` for a skill whose base is a value the player sets; absent on a save. */
  ability?: Ability | "flat";
  modifier: Derived<number>;
  /** The definition's `overrides` key for the modifier. */
  overrideKey: string;
  title: string;
  rules: Rules | undefined;
  effects?: readonly RollEffectEntry[];
  /** Makes the ring a button that moves to the next level, for a row the character owns. */
  onCycleLevel?: () => void;
  /** Marks a skill the table defined, with the Homebrew page's icon beside its ability. */
  homebrew?: boolean;
  /** The foot of the modal the name opens, for an action on the row itself; it shows the total, which the modal's body then leaves out. */
  detailFooter?: ReactNode;
}) {
  const roll = ability ? `${name} check` : `${name} save`;
  return (
    <li className="flex items-center gap-2 py-0.5 text-body">
      {onCycleLevel ? (
        <button
          type="button"
          aria-label={`${name} proficiency: ${PROFICIENCY_MARK[level].text}`}
          onClick={onCycleLevel}
          className="flex rounded-full hover:ring-3 hover:ring-accent/30"
        >
          <ProficiencyRing level={level} />
        </button>
      ) : (
        <ProficiencyRing level={level} />
      )}
      <span>
        <DetailName
          title={title}
          meta={PROFICIENCY_MARK[level].text}
          value={modifier}
          rules={rules}
          footer={detailFooter}
          total={detailFooter === undefined}
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
        <span className="flex items-center gap-1">
          <span className="text-label text-muted uppercase">
            <span aria-hidden="true">{ability}</span>
            <span className="sr-only">
              {ability === "flat" ? "Flat bonus" : ABILITY_LABEL[ability]}
            </span>
          </span>
          {homebrew && (
            // No font size, so the popover's inline box adds no line-height strut around the icon.
            <span className="flex text-[0px]">
              <Popover
                trigger={
                  <FlaskConical aria-hidden="true" size={12} className="block text-accent-text" />
                }
                triggerLabel="Homebrew skill"
                label="Homebrew skill"
              >
                Homebrew skill, defined in{" "}
                <Link to="/settings/homebrew" className="text-accent-text underline">
                  Settings › Homebrew
                </Link>
                .
              </Popover>
            </span>
          )}
        </span>
      )}
      <span className="ms-auto flex items-center gap-2">
        <RollEffectChip roll={roll} effects={effects} />
        <span className="flex w-7 justify-end font-semibold">
          <DerivedValue named name={roll} value={modifier} overrideKey={overrideKey} />
        </span>
      </span>
    </li>
  );
}
