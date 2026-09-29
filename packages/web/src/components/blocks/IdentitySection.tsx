/**
 * The Identity, Level, Alignment and Notes pages, read-only: each draws what the
 * definition already holds, and shows as unavailable until the character loads.
 */
import {
  type CharacterDefinition,
  type CharacterRecord,
  classLevelLabel,
  classLevels,
  displayName,
  totalLevel,
} from "@dnd/character";
import type { ReactNode } from "react";
import { EmptyState } from "../../states.tsx";
import { Card } from "../Card.tsx";
import { ChipList } from "../ChipList.tsx";

type SectionProps = { character: CharacterRecord | undefined };

const classChips = (definition: CharacterDefinition) =>
  classLevels(definition).map(classLevelLabel);

/** A tool held at `none` grants nothing, so it earns no chip. */
const TOOL_SUFFIX = { none: undefined, half: " (half)", proficient: "", expertise: " (expertise)" };

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-muted text-row italic">{children}</p>;
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 font-semibold text-label text-muted">{heading}</h4>
      {children}
    </div>
  );
}

function Unavailable({ page }: { page: string }) {
  return <EmptyState>{page} isn't available yet.</EmptyState>;
}

export function IdentitySection({ character }: SectionProps) {
  if (!character) return <Unavailable page="Identity" />;
  const { definition } = character;
  const { race, subrace, background, proficiencies } = definition;
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
        <ChipList labels={[`${displayName(race)}${subrace ? ` (${subrace.name})` : ""}`]} />
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
          <Group heading="Armor">
            <ChipList labels={proficiencies.armor} empty="No armor." />
          </Group>
          <Group heading="Weapons">
            <ChipList labels={proficiencies.weapons} empty="No weapons." />
          </Group>
          <Group heading="Tools">
            <ChipList labels={tools} empty="No tools." />
          </Group>
        </div>
      </Card>
    </div>
  );
}

export function LevelSection({ character }: SectionProps) {
  if (!character) return <Unavailable page="Level" />;
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

export function AlignmentSection({ character }: SectionProps) {
  if (!character) return <Unavailable page="Alignment" />;
  const { alignment } = character.definition;
  return (
    <Card title="Alignment">
      {alignment ? <p className="text-sm">{alignment}</p> : <Muted>No alignment set.</Muted>}
    </Card>
  );
}

export function NotesSection({ character }: SectionProps) {
  if (!character) return <Unavailable page="Notes" />;
  const { notes } = character.definition;
  return (
    <Card title="Notes">
      {notes.trim() ? (
        <p className="whitespace-pre-wrap text-body">{notes}</p>
      ) : (
        <Muted>No notes yet.</Muted>
      )}
    </Card>
  );
}
