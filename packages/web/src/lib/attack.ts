import { type CharacterDerived, derivedValue } from "@dnd/character";
import { signed } from "./signed.ts";

export type Attack = CharacterDerived["attacks"][number];

export type Grip = NonNullable<Attack["grip"]>["held"];

/** Dice and modifier as a roll is written, `1d8+3`, the modifier left off at zero. */
export function damageText(damage: NonNullable<Attack["damage"]>): string {
  const modifier = derivedValue(damage.modifier);
  return modifier === 0 ? damage.dice : `${damage.dice}${signed(modifier)}`;
}
