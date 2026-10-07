import { MAX_HIT_POINT_GAIN } from "@dnd/character";
import { useState } from "react";
import { InputField } from "../../components/InputField.tsx";
import { parseGain } from "./hitPointGains.ts";

/**
 * One level's typed gain, which keeps what the player types, and its error, until it is a
 * whole number the definition can hold. A grid cell is too narrow for its error, so the
 * error renders in `messages`, named by level.
 */
export function GainInput({
  level,
  gain,
  average,
  messages,
  onGain,
}: {
  level: number;
  gain: number | undefined;
  average: number;
  messages: HTMLElement | null;
  onGain: (gain: number | undefined) => void;
}) {
  const [typing, setTyping] = useState<string>();
  const invalid = typing !== undefined && typing.trim() !== "-" && parseGain(typing) === null;
  return (
    <InputField
      label={`Level ${level} gain`}
      labelHidden
      messageSlot={{ into: messages, name: `Level ${level}` }}
      type="text"
      placeholder={String(average)}
      value={typing ?? (gain === undefined ? "" : String(gain))}
      error={
        invalid
          ? `A hit point gain is a whole number from -${MAX_HIT_POINT_GAIN} to ${MAX_HIT_POINT_GAIN}.`
          : undefined
      }
      className="w-full min-w-0 text-center"
      onChange={(event) => {
        setTyping(event.target.value);
        const parsed = parseGain(event.target.value);
        if (parsed !== null) onGain(parsed);
      }}
      // Text the gain cannot hold stays with its error, so leaving the field drops nothing silently.
      onBlur={() => {
        if (!invalid) setTyping(undefined);
      }}
    />
  );
}
