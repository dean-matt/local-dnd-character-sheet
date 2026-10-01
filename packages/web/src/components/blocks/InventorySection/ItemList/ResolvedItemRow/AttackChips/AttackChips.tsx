/**
 * A weapon attack's two numbers as the chips a row draws, each opening the terms the
 * derived block computed it from.
 */
import { derivedValue } from "@dnd/character";
import { type Attack, damageText } from "../../../../../../lib/attack.ts";
import { signed } from "../../../../../../lib/signed.ts";
import { Popover } from "../../../../../Popover.tsx";
import { TermList } from "../../../../../TermList.tsx";
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
        <TermList terms={attack.attackBonus.terms ?? []} />
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
          <TermList terms={damage.modifier.terms ?? []} />
        </Popover>
      )}
    </>
  );
}
