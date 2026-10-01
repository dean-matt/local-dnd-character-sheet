import { type CharacterRecord, totalLevel } from "@dnd/character";
import { Card } from "../Card.tsx";
import { ChipList } from "../ChipList.tsx";
import { classChips } from "./classChips.ts";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

export function LevelSection({ character }: { character: CharacterRecord | undefined }) {
  if (!character) return <SectionUnavailable page="Level" />;
  const { definition } = character;
  return (
    <Card title="Level">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <p className="font-bold text-[32px] leading-none">
          <span className="sr-only">Total level </span>
          {totalLevel(definition)}
        </p>
        <ChipList labels={classChips(definition)} />
      </div>
    </Card>
  );
}
