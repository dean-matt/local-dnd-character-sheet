/**
 * The Identity page, read-only: it draws what the definition already holds, and shows as
 * unavailable until the character loads, as the Level, Alignment and Notes pages beside it do.
 */
import { type CharacterRecord, displayName, raceLabel, totalLevel } from "@dnd/character";
import { Card } from "../../Card.tsx";
import { ChipList } from "../../ChipList.tsx";
import { classChips } from "../classChips.ts";
import { SectionUnavailable } from "../SectionUnavailable.tsx";
import { ProficiencyGroup } from "./ProficiencyGroup.tsx";

/** A tool held at `none` grants nothing, so it earns no chip. */
const TOOL_SUFFIX = { none: undefined, half: " (half)", proficient: "", expertise: " (expertise)" };

export function IdentitySection({ character }: { character: CharacterRecord | undefined }) {
  if (!character) return <SectionUnavailable page="Identity" />;
  const { definition } = character;
  const { background, proficiencies } = definition;
  const tools = proficiencies.tools.flatMap(({ name, level }) => {
    const suffix = TOOL_SUFFIX[level];
    return suffix === undefined ? [] : [`${name}${suffix}`];
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Name">
        <p className="text-sm">{definition.name}</p>
      </Card>
      <Card title="Race">
        <ChipList labels={[raceLabel(definition)]} />
      </Card>
      <Card title="Class">
        <div className="flex flex-col gap-2">
          <ChipList labels={classChips(definition)} />
          <p className="text-label text-muted">Total level: {totalLevel(definition)}</p>
        </div>
      </Card>
      <Card title="Background">
        <ChipList labels={[displayName(background)]} />
      </Card>
      <Card title="Languages">
        <ChipList labels={proficiencies.languages.map((ref) => ref.name)} empty="No languages." />
      </Card>
      <Card title="Proficiencies">
        {/* Armor and weapons are categories, and `Light` names one of each, so each keeps a heading. */}
        <div className="flex flex-col gap-2.5">
          <ProficiencyGroup heading="Armor">
            <ChipList labels={proficiencies.armor} empty="No armor." />
          </ProficiencyGroup>
          <ProficiencyGroup heading="Weapons">
            <ChipList labels={proficiencies.weapons} empty="No weapons." />
          </ProficiencyGroup>
          <ProficiencyGroup heading="Tools">
            <ChipList labels={tools} empty="No tools." />
          </ProficiencyGroup>
        </div>
      </Card>
    </div>
  );
}
