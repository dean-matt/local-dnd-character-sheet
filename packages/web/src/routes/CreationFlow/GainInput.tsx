import { useState } from "react";
import { InputField } from "../../components/InputField.tsx";
import { parseGain } from "./hitPointGains.ts";

/**
 * One level's typed gain, which keeps what the player types until it is a whole number. A
 * grid cell is too narrow for its error, so the error renders in `messages`, named by level.
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
  return (
    <InputField
      label={`Level ${level} gain`}
      labelHidden
      messageSlot={{ into: messages, name: `Level ${level}` }}
      type="text"
      placeholder={String(average)}
      value={typing ?? (gain === undefined ? "" : String(gain))}
      error={
        typing !== undefined && typing.trim() !== "-" && parseGain(typing) === null
          ? "A hit point gain is a whole number."
          : undefined
      }
      className="w-full min-w-0 text-center"
      onChange={(event) => {
        setTyping(event.target.value);
        const parsed = parseGain(event.target.value);
        if (parsed !== null) onGain(parsed);
      }}
      onBlur={() => setTyping(undefined)}
    />
  );
}
