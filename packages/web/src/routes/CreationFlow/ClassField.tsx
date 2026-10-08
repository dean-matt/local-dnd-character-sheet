import type { CharacterDefinition, EntryRef } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { CatalogPicker } from "../../components/CatalogPicker/CatalogPicker.tsx";
import { useEnsureHomebrewClass } from "../../hooks/useEnsureHomebrewClass.ts";
import { ClassEscape } from "./ClassEscape.tsx";
import { withClassCount } from "./classLevels.ts";
import { CLASS_FIELD, withDeparture } from "./departures.ts";

const OPTS = { shouldDirty: true } as const;

export interface ClassFieldProps {
  edition: CharacterDefinition["edition"];
  /** The levels the class starts with: those a cleared class held, so a change keeps the level. */
  count: number;
  focusOnMount: boolean;
  onPicked: (ref: EntryRef) => void;
}

/**
 * The character's first class, chosen through the picker or typed past it, shown while the
 * draft holds none. A typed class becomes a homebrew class carrying the hit die the player
 * names, so the sheet still counts hit points, and writes a departure, since the sheet
 * derives no features from it. The class takes no subclass or roll from one cleared before.
 */
export function ClassField({ edition, count, focusOnMount, onPicked }: ClassFieldProps) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const ensure = useEnsureHomebrewClass();

  function choose(ref: EntryRef, note?: string) {
    setValue("levels", withClassCount([], ref, count), OPTS);
    setValue("departures", withDeparture(getValues("departures"), CLASS_FIELD, note), OPTS);
    onPicked(ref);
  }

  return (
    <div className="flex flex-col gap-2">
      <CatalogPicker
        label="Class"
        edition={edition}
        type="class"
        placeholder="Choose a class…"
        focusOnMount={focusOnMount}
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
