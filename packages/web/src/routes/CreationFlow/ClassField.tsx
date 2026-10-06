import { type CharacterDefinition, displayName, type EntryRef } from "@dnd/character";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { useEnsureHomebrewClass } from "../../hooks/useEnsureHomebrewClass.ts";
import { ChosenChip } from "./ChosenChip.tsx";
import { ClassEscape } from "./ClassEscape.tsx";
import { levelsIn } from "./classLevels.ts";
import { withDeparture } from "./departures.ts";
import { useClassCatalog } from "./useClassCatalog.ts";

const OPTS = { shouldDirty: true } as const;

/**
 * The class, chosen through the picker or typed past it. A typed class becomes a homebrew
 * class carrying the hit die the player names, so the sheet still counts hit points, and
 * writes a departure, since the sheet derives no features from it. A change keeps the level
 * and drops the subclass and every roll, which belonged to the old class and its die.
 */
export function ClassField() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const { edition, levels, cls, homebrew } = useClassCatalog();
  const ensure = useEnsureHomebrewClass();
  const [moved, setMoved] = useState(false);
  // × empties `levels`, so the level the player set rides here until the next pick.
  const [count, setCount] = useState(Math.max(levels.length, 1));

  function choose(ref: EntryRef | undefined, note?: string) {
    const keep = levels.length || count;
    setCount(keep);
    setValue("levels", ref ? levelsIn(ref, keep, []) : [], OPTS);
    setValue("departures", withDeparture(getValues("departures"), "levels", note), OPTS);
    setMoved(true);
  }

  if (cls === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <CatalogPicker
          label="Class"
          edition={edition}
          type="class"
          placeholder="Choose a class…"
          focusOnMount={moved}
          onPick={(ref) => choose(ref)}
        />
        <ClassEscape
          pending={ensure.isPending}
          error={ensure.error?.message}
          onUse={(name, faces) =>
            ensure.mutate(
              { name, edition, hd: { number: 1, faces } },
              {
                onSuccess: (record) =>
                  choose(
                    { homebrewId: record.id },
                    `${record.name} is a homebrew class, so the sheet takes its d${record.hitDie} hit die and derives no features from it.`,
                  ),
              },
            )
          }
        />
      </div>
    );
  }

  const value = "homebrewId" in cls ? (homebrew.data?.name ?? displayName(cls)) : cls.name;
  return (
    <ChosenChip
      label="Class"
      value={value}
      focusOnMount={moved}
      onClear={() => choose(undefined)}
    />
  );
}
