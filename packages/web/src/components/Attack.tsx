/**
 * A weapon attack's two numbers as the chips a row draws, each opening the terms the
 * derived block computed it from.
 */
import { type CharacterDerived, derivedValue } from "@dnd/character";
import type { ReactNode } from "react";
import { Popover } from "./Popover.tsx";
import { CHIP } from "./Tag.tsx";
import { TermList } from "./TermList.tsx";

export type Attack = CharacterDerived["attacks"][number];

export type Grip = NonNullable<Attack["grip"]>["held"];

export const signed = (value: number) => (value < 0 ? `${value}` : `+${value}`);

/** Dice and modifier as a roll is written, `1d8+3`, the modifier left off at zero. */
export function damageText(damage: NonNullable<Attack["damage"]>): string {
  const modifier = derivedValue(damage.modifier);
  return modifier === 0 ? damage.dice : `${damage.dice}${signed(modifier)}`;
}

const GRIP_LABEL = { "one-handed": "One-handed", "two-handed": "Two-handed" } as const;

function Chip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span
      className={`${CHIP} flex items-baseline gap-0.75 border-accent bg-surface text-accent-text`}
    >
      <span className="font-normal text-muted">{label}</span>
      {children}
    </span>
  );
}

export function AttackChips({ name, attack }: { name: string; attack: Attack }) {
  const bonus = signed(derivedValue(attack.attackBonus));
  const { damage, grip } = attack;
  return (
    <>
      <Popover
        trigger={<Chip label="Attack">d20 {bonus}</Chip>}
        triggerLabel={`${name} attack bonus ${bonus}`}
        label={`${name} attack bonus`}
      >
        <TermList terms={attack.attackBonus.terms ?? []} />
      </Popover>
      {damage && (
        <Popover
          trigger={<Chip label="Damage">{damageText(damage)}</Chip>}
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
