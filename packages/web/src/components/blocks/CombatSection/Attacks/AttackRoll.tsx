import type { RollEffectEntry } from "@dnd/character";
import { type ComponentProps, useState } from "react";
import { ModeRoll } from "../../../ModeRoll.tsx";
import type { RollBonusButton } from "../../../RollBonusButton.tsx";

const FLANKING: RollEffectEntry = { source: "Flanking", mode: "advantage", roll: "attack" };

/**
 * An attack's roll button with the mode it rolls in: the net of the advantage and
 * disadvantage on it to start, changed by the player. The sources of every effect, a
 * conditional one included, are spoken with the control. Where the table plays `flanking`, a
 * melee attack offers a Flanking checkbox: as advantage it joins the effects, as a bonus it adds 2
 * and the roll's label names it, so the log shows what the total holds.
 */
export function AttackRoll({
  label,
  type,
  origin,
  bonus,
  terms,
  effects,
  beforeRoll,
  critAt,
  flanking,
  onRolled,
}: Pick<
  ComponentProps<typeof RollBonusButton>,
  "label" | "type" | "origin" | "bonus" | "terms" | "critAt" | "onRolled"
> & {
  effects: readonly RollEffectEntry[];
  beforeRoll?: () => Promise<boolean>;
  /** The table's flanking rule where this attack is melee, else absent or `none`. */
  flanking?: "none" | "advantage" | "bonus";
}) {
  const [flanked, setFlanked] = useState(false);
  const flanks = flanking !== undefined && flanking !== "none";
  const flankingAdvantage = flanks && flanked && flanking === "advantage";
  const flankingBonus = flanks && flanked && flanking === "bonus";
  return (
    <ModeRoll
      effects={flankingAdvantage ? [...effects, FLANKING] : effects}
      modeLabel={label}
      label={
        flankingAdvantage || flankingBonus
          ? `${label} while flanking${flankingBonus ? " +2" : ""}`
          : label
      }
      type={type}
      origin={origin}
      terms={
        flankingBonus
          ? [
              ...(terms ?? [{ source: "Attack bonus", value: bonus }]),
              { source: "Flanking", value: 2 },
            ]
          : terms
      }
      bonus={flankingBonus ? bonus + 2 : bonus}
      beforeRoll={beforeRoll}
      critAt={critAt}
      onRolled={onRolled}
    >
      {flanks && (
        <label className="flex items-center gap-1 text-label">
          <input
            type="checkbox"
            checked={flanked}
            onChange={(event) => setFlanked(event.target.checked)}
          />
          Flanking
        </label>
      )}
    </ModeRoll>
  );
}
