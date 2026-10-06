import { HIT_DICE } from "@dnd/character";
import { useState } from "react";
import { InputField } from "../../components/InputField.tsx";
import { ChoicePills } from "./ChoicePills.tsx";

export interface ClassEscapeProps {
  onUse: (name: string, faces: number) => void;
  pending: boolean;
  error?: string;
}

/**
 * The way past the catalog: a class typed by name, with the hit die the sheet needs to
 * count its hit points.
 */
export function ClassEscape({ onUse, pending, error }: ClassEscapeProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [faces, setFaces] = useState<number>();
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit font-semibold text-accent-text text-row"
      >
        Not listed? Type a class
      </button>
    );
  }
  const typed = name.trim();
  const ready = typed !== "" && faces !== undefined && !pending;
  return (
    <div className="flex flex-col gap-1">
      <InputField
        label="Class name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          // Enter would submit the whole flow; here it uses the typed class.
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (ready) onUse(typed, faces);
        }}
      />
      <ChoicePills
        legend="Hit die"
        prompting={faces === undefined}
        options={HIT_DICE.map((die) => ({ value: String(die), label: `d${die}` }))}
        value={faces === undefined ? undefined : String(faces)}
        onChange={(value) => setFaces(Number(value))}
      />
      <button
        type="button"
        disabled={!ready}
        onClick={() => ready && onUse(typed, faces)}
        className="mt-1 w-fit rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body disabled:opacity-60"
      >
        Use
      </button>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </div>
  );
}
