import type { CharacterDefinition } from "@dnd/character";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { InputField } from "../../components/InputField.tsx";
import { withClassCount } from "./classLevels.ts";
import type { ClassEntry } from "./useClassEntries.ts";

export interface LevelFieldProps {
  entry: ClassEntry;
  label: string;
  /** The most levels the class may hold, which the character's other classes bring below 20. */
  max: number;
}

/**
 * The levels the character starts with in one class, 1 to `max`. A level lowered past the
 * one that holds the subclass drops it; every roll a kept level holds stays.
 */
export function LevelField({ entry, label, max }: LevelFieldProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  // What the player is typing, which may be empty or out of range until the field blurs.
  const [typing, setTyping] = useState<string>();
  const isLevel = (text: string) => {
    const count = Number(text);
    return text.trim() !== "" && Number.isInteger(count) && count >= 1 && count <= max;
  };

  return (
    <InputField
      label={label}
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={typing ?? String(entry.level)}
      error={
        typing !== undefined && !isLevel(typing)
          ? `A level is a whole number from 1 to ${max}.`
          : undefined
      }
      className="w-20"
      onChange={(event) => {
        setTyping(event.target.value);
        if (!isLevel(event.target.value)) return;
        const levels = getValues("levels") ?? [];
        setValue("levels", withClassCount(levels, entry.cls, Number(event.target.value)), {
          shouldDirty: true,
        });
      }}
      onBlur={() => setTyping(undefined)}
    />
  );
}
