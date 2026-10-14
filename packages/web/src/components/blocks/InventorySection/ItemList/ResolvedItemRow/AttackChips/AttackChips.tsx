/**
 * A weapon attack's two numbers as the chips a row draws, each opening the terms the
 * derived block computed it from.
 */
import { derivedValue } from "@dnd/character";
import { Popover } from "../../../../../Popover.tsx";
import { type Attack, damageText } from "../../../../attack.ts";
import { DerivedBreakdown } from "../../../../DerivedBreakdown.tsx";
import { signed } from "../../../../signed.ts";
import { AttackChip } from "./AttackChip.tsx";

const GRIP_LABEL = { "one-handed": "One-handed", "two-handed": "Two-handed" } as const;

export function AttackChips({ name, attack }: { name: string; attack: Attack }) {
  const bonus = signed(derivedValue(attack.attackBonus));
  const { damage, grip } = attack;
  return (
    <>
      <Popover
        trigger={<AttackChip label="Attack">d20 {bonus}</AttackChip>}
        triggerLabel={`${name} attack bonus ${bonus}`}
        label={`${name} attack bonus`}
      >
        <DerivedBreakdown
          name={`${name} attack bonus`}
          value={attack.attackBonus}
          format={signed}
        />
      </Popover>
      {damage && (
        <Popover
          trigger={<AttackChip label="Damage">{damageText(damage)}</AttackChip>}
          triggerLabel={`${name} damage ${damageText(damage)}`}
          label={`${name} damage`}
        >
          <p className="mb-1">
            {grip && `${GRIP_LABEL[grip.held]} `}
            {damage.dice}
          </p>
          <DerivedBreakdown name={`${name} damage`} value={damage.modifier} format={signed} />
        </Popover>
      )}
    </>
  );
}
