import type { CharacterDefinition } from "@dnd/character";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { InputField } from "../../components/InputField.tsx";
import { levelsIn, subclassOf, withSubclass } from "./classLevels.ts";
import { useClassCatalog } from "./useClassCatalog.ts";

const isLevel = (text: string) => {
  const count = Number(text);
  return text.trim() !== "" && Number.isInteger(count) && count >= 1 && count <= 20;
};

/**
 * The level the character starts at, 1 to 20. A level lowered past the one that grants
 * the subclass drops it; every roll a kept level holds stays.
 */
export function LevelField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const { levels, cls, subclassLevel } = useClassCatalog();
  // What the player is typing, which may be empty or out of range until the field blurs.
  const [typing, setTyping] = useState<string>();
  if (cls === undefined) return null;
  const chosen = subclassOf(levels);
  // Until the class row loads, the subclass keeps the level it sits on.
  const at = subclassLevel ?? levels.findIndex((level) => level.subclass) + 1;

  return (
    <InputField
      label="Level"
      type="number"
      inputMode="numeric"
      min={1}
      max={20}
      value={typing ?? String(levels.length)}
      error={
        typing !== undefined && !isLevel(typing)
          ? "A level is a whole number from 1 to 20."
          : undefined
      }
      className="w-20"
      onChange={(event) => {
        setTyping(event.target.value);
        if (!isLevel(event.target.value)) return;
        const count = Number(event.target.value);
        const subclass = count >= at ? chosen : undefined;
        setValue("levels", withSubclass(levelsIn(cls, count, levels), subclass, at), {
          shouldDirty: true,
        });
      }}
      onBlur={() => setTyping(undefined)}
    />
  );
}
