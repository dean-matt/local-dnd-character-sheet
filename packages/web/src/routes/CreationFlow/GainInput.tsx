import { useState } from "react";
import { InputField } from "../../components/InputField.tsx";
import { parseGain } from "./hitPointGains.ts";

/** One level's typed gain, which keeps what the player types until it is a whole number. */
export function GainInput({
  level,
  gain,
  average,
  onGain,
}: {
  level: number;
  gain: number | undefined;
  average: number;
  onGain: (gain: number | undefined) => void;
}) {
  const [typing, setTyping] = useState<string>();
  return (
    <InputField
      label={`Level ${level} gain`}
      type="number"
      inputMode="numeric"
      placeholder={String(average)}
      value={typing ?? (gain === undefined ? "" : String(gain))}
      error={
        typing !== undefined && parseGain(typing) === null
          ? "A hit point gain is a whole number."
          : undefined
      }
      className="w-20"
      onChange={(event) => {
        setTyping(event.target.value);
        const parsed = parseGain(event.target.value);
        if (parsed !== null) onGain(parsed);
      }}
      onBlur={() => setTyping(undefined)}
    />
  );
}
