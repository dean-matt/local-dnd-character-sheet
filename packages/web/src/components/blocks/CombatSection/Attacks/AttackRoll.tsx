import { netRollEffect, type RollEffectEntry } from "@dnd/character";
import { type ComponentProps, useContext, useId, useState } from "react";
import { RollBonusButton } from "../../../RollBonusButton.tsx";
import { RollingFor } from "../../../rollerContext.ts";

type Mode = NonNullable<ComponentProps<typeof RollBonusButton>["mode"]>;

const MODES: readonly { value: Mode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "advantage", label: "Advantage" },
  { value: "disadvantage", label: "Disadvantage" },
];

/** The net of the effects that hold without a condition; a conditional one is the table's to judge. */
function offered(effects: readonly RollEffectEntry[]): Mode {
  const net = netRollEffect(effects.filter(({ condition }) => condition === undefined));
  return net && net.mode !== "cancel" ? net.mode : "normal";
}

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
  effects,
  beforeRoll,
  critAt,
  flanking,
  onRolled,
}: Pick<
  ComponentProps<typeof RollBonusButton>,
  "label" | "type" | "origin" | "bonus" | "critAt" | "onRolled"
> & {
  effects: readonly RollEffectEntry[];
  beforeRoll?: () => Promise<boolean>;
  /** The table's flanking rule where this attack is melee, else absent or `none`. */
  flanking?: "none" | "advantage" | "bonus";
}) {
  const characterId = useContext(RollingFor);
  const sources = useId();
  const [flanked, setFlanked] = useState(false);
  const flanks = flanking !== undefined && flanking !== "none";
  const flankingAdvantage = flanks && flanked && flanking === "advantage";
  const flankingBonus = flanks && flanked && flanking === "bonus";
  const held = flankingAdvantage ? [...effects, FLANKING] : effects;
  const start = offered(held);
  const [chosen, setChosen] = useState<{ start: Mode; mode: Mode }>({ start, mode: start });
  const mode = chosen.start === start ? chosen.mode : start;
  if (characterId === null) return null;
  const names = held.map(
    ({ source, mode: effect, condition }) =>
      `${source}: ${effect}${condition ? ` ${condition}` : ""}`,
  );
  return (
    <span className="flex items-center gap-0.5">
      <select
        aria-label={`${label} mode`}
        aria-describedby={names.length > 0 ? sources : undefined}
        value={mode}
        onChange={(event) => setChosen({ start, mode: event.target.value as Mode })}
        className="min-h-6 min-w-0 rounded-control border border-border bg-surface text-label"
      >
        {MODES.map(({ value, label: text }) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <span id={sources} className="sr-only">
        {names.join("; ")}
      </span>
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
      <RollBonusButton
        label={
          flankingAdvantage || flankingBonus
            ? `${label} while flanking${flankingBonus ? " +2" : ""}`
            : label
        }
        type={type}
        origin={origin}
        bonus={flankingBonus ? bonus + 2 : bonus}
        mode={mode}
        beforeRoll={beforeRoll}
        critAt={critAt}
        onRolled={onRolled}
      />
    </span>
  );
}
