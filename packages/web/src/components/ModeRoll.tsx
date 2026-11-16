import { netRollEffect, type RollEffectEntry } from "@dnd/character";
import { type ComponentProps, type ReactNode, useContext, useId, useState } from "react";
import { useInspiration } from "../hooks/useInspiration.ts";
import { parseExtraDie } from "../lib/extraDie.ts";
import { ExtraDieInput } from "./ExtraDieInput.tsx";
import { InspirationToggle } from "./InspirationToggle.tsx";
import { RollBonusButton } from "./RollBonusButton.tsx";
import { RollingFor } from "./rollerContext.ts";

type Mode = NonNullable<ComponentProps<typeof RollBonusButton>["mode"]>;

const MODES: readonly { value: Mode; text: string; label: string }[] = [
  { value: "normal", text: "Normal", label: "Normal" },
  { value: "advantage", text: "Adv", label: "Advantage" },
  { value: "disadvantage", text: "Dis", label: "Disadvantage" },
];

/** The net of the effects that hold without a condition; a conditional one is the table's to judge. */
function offered(effects: readonly RollEffectEntry[]): Mode {
  const net = netRollEffect(effects.filter(({ condition }) => condition === undefined));
  return net && net.mode !== "cancel" ? net.mode : "normal";
}

/**
 * A roll button with the mode it rolls in: the net of the advantage and disadvantage on it to
 * start, changed by the player, and a die the player names to add or subtract, such as +1d4 for
 * Bless or -1d4 for Bane. The sources of every effect, a conditional one included, are
 * spoken with the control. `children` sit between the mode and the button.
 * With `inspiration`, a character holding it may spend it on the roll: advantage, or a reroll
 * that counts, by its edition and house rules. The roll clears it in one state write. A reroll
 * is of a single d20 in the normal mode, so one with a mode or a die the player named offers
 * no spending.
 */
export function ModeRoll({
  effects = [],
  modeLabel,
  inspiration = false,
  children,
  ...roll
}: Omit<ComponentProps<typeof RollBonusButton>, "mode"> & {
  effects?: readonly RollEffectEntry[];
  /** What the mode control names, where the roll's label changes under it. */
  modeLabel?: string;
  inspiration?: boolean;
  children?: ReactNode;
}) {
  const characterId = useContext(RollingFor);
  const sources = useId();
  const extraError = useId();
  const start = offered(effects);
  const [extra, setExtra] = useState("");
  const [chosen, setChosen] = useState<{ start: Mode; mode: Mode }>({ start, mode: start });
  const mode = chosen.start === start ? chosen.mode : start;
  const spend = useInspiration(characterId ?? "", inspiration, mode, extra);
  if (characterId === null) return null;
  const names = effects.map(
    ({ source, mode: effect, condition }) =>
      `${source}: ${effect}${condition ? ` ${condition}` : ""}`,
  );
  return (
    <span className="flex items-center gap-0.5">
      <select
        aria-label={`${modeLabel ?? roll.label} mode`}
        aria-describedby={names.length > 0 ? sources : undefined}
        value={mode}
        onChange={(event) => setChosen({ start, mode: event.target.value as Mode })}
        className="min-h-6 min-w-0 rounded-control border border-border bg-surface text-label"
      >
        {MODES.map(({ value, text, label }) => (
          <option key={value} value={value} aria-label={label}>
            {text}
          </option>
        ))}
      </select>
      <span id={sources} className="sr-only">
        {names.join("; ")}
      </span>
      {children}
      <ExtraDieInput
        label={modeLabel ?? roll.label}
        value={extra}
        onChange={setExtra}
        error={parseExtraDie(extra).error}
        describedBy={extraError}
      />
      <span id={extraError} className="sr-only">
        {parseExtraDie(extra).error}
      </span>
      {spend.offered && <InspirationToggle {...spend} />}
      <RollBonusButton
        {...roll}
        mode={spend.mode}
        extra={extra}
        d20={spend.d20}
        beforeRoll={spend.spending ? spend.spend : roll.beforeRoll}
      />
    </span>
  );
}
