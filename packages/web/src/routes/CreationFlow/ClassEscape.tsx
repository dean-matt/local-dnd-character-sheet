import { HIT_DICE } from "@dnd/character";
import { useState } from "react";
import { ChoicePills } from "./ChoicePills.tsx";
import { TypedEscape } from "./TypedEscape.tsx";

export interface ClassEscapeProps {
  onUse: (name: string, faces: number) => void;
  pending: boolean;
  error?: string;
}

/** A class typed past the catalog, with the hit die the sheet needs to count its hit points. */
export function ClassEscape({ onUse, pending, error }: ClassEscapeProps) {
  const [faces, setFaces] = useState<number>();
  return (
    <TypedEscape
      noun="class"
      canUse={faces !== undefined && !pending}
      error={error}
      onUse={(name) => faces !== undefined && onUse(name, faces)}
    >
      <ChoicePills
        legend="Hit die"
        prompting={faces === undefined}
        options={HIT_DICE.map((die) => ({ value: String(die), label: `d${die}` }))}
        value={faces === undefined ? undefined : String(faces)}
        onChange={(value) => setFaces(Number(value))}
      />
    </TypedEscape>
  );
}
