import { type CharacterDerived, derivedValue, type RollRecord } from "@dnd/character";
import { signed } from "./signed.ts";

export type Attack = CharacterDerived["attacks"][number];

/** An attack roll that landed, and the features that have added to it since. */
export type Landed = {
  label: string;
  roll: Pick<RollRecord, "notation" | "total" | "dice" | "modifier" | "critical" | "mode">;
  sources: string[];
};

export type Grip = NonNullable<Attack["grip"]>["held"];

/** What tells one trade from another on a row: a feature offering several names each by its condition. */
export const tradeKey = ({ source, condition }: Attack["options"][number]) =>
  `${source}|${condition}`;

/** Dice and modifier as a roll is written, `1d8+3`, the modifier left off at zero. */
export function damageText(damage: NonNullable<Attack["damage"]>): string {
  const modifier = derivedValue(damage.modifier);
  return modifier === 0 ? damage.dice : `${damage.dice}${signed(modifier)}`;
}
