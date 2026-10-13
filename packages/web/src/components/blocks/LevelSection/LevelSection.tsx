import { type CharacterRecord, totalLevel } from "@dnd/character";
import { useId } from "react";
import { Card } from "../../Card.tsx";
import { ChipList } from "../../ChipList.tsx";
import { classChips } from "../classChips.ts";
import { SectionUnavailable } from "../SectionUnavailable.tsx";
import { ExperienceTracker } from "./ExperienceTracker.tsx";
import { Improvements } from "./Improvements.tsx";
import { LevelHistory } from "./LevelHistory.tsx";
import { LevelingField } from "./LevelingField.tsx";
import { LevelUp } from "./LevelUp/LevelUp.tsx";

export function LevelSection({ character }: { character: CharacterRecord | undefined }) {
  const captionId = useId();
  if (!character) return <SectionUnavailable page="Level" />;
  const { definition } = character;
  const xp = definition.leveling === "xp";
  return (
    <div className="flex flex-col gap-3">
      <Card title="Level">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <p className="font-bold text-[32px] leading-none">
              <span className="sr-only">Total level </span>
              {totalLevel(definition)}
            </p>
            <ChipList labels={classChips(definition)} />
          </div>
          <LevelingField character={character} />
          {xp ? (
            <ExperienceTracker character={character} captionId={captionId} />
          ) : (
            <p className="text-body text-muted italic">
              Milestone leveling — the DM says when you level; no experience points tracked.
            </p>
          )}
          <LevelUp character={character} describedBy={xp ? captionId : undefined} />
        </div>
      </Card>
      <Improvements character={character} />
      <LevelHistory character={character} />
    </div>
  );
}
