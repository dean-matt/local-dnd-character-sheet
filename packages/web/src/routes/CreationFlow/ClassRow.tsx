import { ABILITIES, type CharacterDefinition } from "@dnd/character";
import { useWatch } from "react-hook-form";
import { ChosenChip } from "./ChosenChip.tsx";
import { ClassGrantsSummary } from "./ClassGrantsSummary.tsx";
import { DepartureMark } from "./DepartureMark.tsx";
import { CLASS_FIELD } from "./departures.ts";
import { LevelField } from "./LevelField.tsx";
import { prerequisiteField, prerequisiteText } from "./multiclassPrerequisites.ts";
import { SubclassField } from "./SubclassField.tsx";
import type { ClassEntry } from "./useClassEntries.ts";

export interface ClassRowProps {
  entry: ClassEntry;
  first: boolean;
  /** The character holds more than one class, so each row names its own fields. */
  multiclassed: boolean;
  /** The most levels this class may hold beside the others. */
  max: number;
  focusOnMount: boolean;
  onRemove: () => void;
}

/**
 * One class the character starts in: the class, its level, its subclass and what it grants.
 * A multiclassed row also names the scores the class needs to multiclass — noted as a
 * departure where the scores fall short, and as guidance until they are set.
 */
export function ClassRow({
  entry,
  first,
  multiclassed,
  max,
  focusOnMount,
  onRemove,
}: ClassRowProps) {
  const scores = useWatch<CharacterDefinition, "abilityScores">({ name: "abilityScores" });
  const unscored = !ABILITIES.every((ability) => Number.isInteger(scores?.[ability]));
  const prerequisite = multiclassed && entry.prerequisite?.length ? entry.prerequisite : undefined;
  return (
    <div className={`flex flex-col gap-4 ${first ? "" : "border-border border-t pt-4"}`}>
      <div className="flex flex-col gap-1.5">
        <ChosenChip
          label="Class"
          value={entry.name}
          focusOnMount={focusOnMount}
          onClear={onRemove}
        />
        {first && "homebrewId" in entry.cls && <DepartureMark field={CLASS_FIELD} />}
      </div>
      <LevelField entry={entry} label={multiclassed ? `${entry.name} level` : "Level"} max={max} />
      <SubclassField entry={entry} legend={multiclassed ? `${entry.name} subclass` : "Subclass"} />
      <ClassGrantsSummary entry={entry} first={first} />
      {prerequisite && unscored && (
        <p className="text-muted text-row">
          Multiclassing in or out of {entry.name} needs {prerequisiteText(prerequisite)}.
        </p>
      )}
      {prerequisite && <DepartureMark field={prerequisiteField(entry.firstIndex)} />}
    </div>
  );
}
