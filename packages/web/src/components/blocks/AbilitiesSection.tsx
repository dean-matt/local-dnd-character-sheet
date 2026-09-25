/**
 * The top of the sheet: who the character is, then the numbers a player reads constantly.
 * Every number comes off the derived block; the definition supplies only what a player
 * chose — the scores, the names, and which saves and skills they are proficient in.
 */
import {
  ABILITY_LABEL,
  type Ability,
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterRecord,
  classLevels,
  type Derived,
  displayName,
  refKey,
  type Speed,
} from "@dnd/character";
import { type ReactNode, useId } from "react";
import { EmptyState } from "../../states.tsx";
import { Field } from "../Field.tsx";

type ProficiencyLevel = CharacterDefinition["proficiencies"]["skills"][number]["level"];

const ABILITIES = Object.keys(ABILITY_LABEL) as Ability[];

/** The three passive scores a table asks for, looked up by the skill's name in either edition. */
const PASSIVE_SKILLS = ["Perception", "Insight", "Investigation"];

const PROFICIENCY_MARK: Record<ProficiencyLevel, { symbol: string; text: string }> = {
  none: { symbol: "○", text: "Not proficient" },
  half: { symbol: "◐", text: "Half proficiency" },
  proficient: { symbol: "●", text: "Proficient" },
  expertise: { symbol: "◆", text: "Expertise" },
};

const signed = (value: number) => (value < 0 ? `${value}` : `+${value}`);
const plain = (value: number) => `${value}`;

function formatSpeed(speed: Speed): string {
  const { walk, ...others } = speed;
  const modes = Object.entries(others).map(([mode, feet]) => `${mode} ${feet} ft.`);
  return [`${walk} ft.`, ...modes].join(", ");
}

/** A value the rules leave unset, shown as a dash and spoken as "none" rather than as zero. */
function Absent() {
  return (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">None</span>
    </span>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-4">
      <h3 id={id} className="font-semibold text-muted text-row uppercase tracking-wide">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** The dot a reader checks as often as the total. Spoken only where there is proficiency to name. */
function ProficiencyRow({
  level,
  name,
  modifier,
}: {
  level: ProficiencyLevel;
  name: string;
  modifier: Derived<number>;
}) {
  const mark = PROFICIENCY_MARK[level];
  return (
    <li className="flex items-baseline gap-2 text-row">
      <span aria-hidden="true" title={mark.text} className="text-accent">
        {mark.symbol}
      </span>
      <span className="flex-1">
        {name}
        {level !== "none" && <span className="sr-only">, {mark.text.toLowerCase()}</span>}
      </span>
      <Field mode="read" label="modifier" labelHidden value={modifier} format={signed} />
    </li>
  );
}

function Identity({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const classes = classLevels(definition)
    .map((group) => {
      const subclass = group.subclass ? ` (${group.subclass.name})` : "";
      return `${displayName(group.class)} ${group.level}${subclass}`;
    })
    .join(" / ");
  const facts: [string, ReactNode][] = [
    ["Class", classes],
    ["Level", character.level],
    ["Race", character.raceSummary],
    ["Background", displayName(definition.background)],
    ["Alignment", definition.alignment ?? <Absent />],
  ];

  return (
    <header>
      <h2 className="font-semibold text-xl">{character.name}</h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-row sm:grid-cols-5">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt className="text-muted">{term}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function AbilityScores({
  definition,
  derived,
}: {
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  return (
    <Card title="Ability Scores">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => (
          <div key={ability} className="flex flex-col items-center rounded-card bg-canvas py-2">
            <dt className="text-muted text-row uppercase">
              <span aria-hidden="true">{ability}</span>
              <span className="sr-only">{ABILITY_LABEL[ability]}</span>
            </dt>
            <dd className="flex flex-col items-center">
              <span className="font-bold text-number">{definition.abilityScores[ability]}</span>
              <span className="sr-only">, </span>
              <Field
                mode="read"
                label="modifier"
                labelHidden
                value={derived.abilityModifiers[ability]}
                format={signed}
              />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Combat({ derived }: { derived: CharacterDerived }) {
  return (
    <Card title="Combat">
      <div className="flex flex-col gap-1">
        <Field mode="read" label="Armor Class" value={derived.armorClass} format={plain} />
        <Field mode="read" label="Initiative" value={derived.initiative} format={signed} />
        <Field mode="read" label="Speed" value={derived.speed} format={formatSpeed} />
        <Field
          mode="read"
          label="Proficiency Bonus"
          value={derived.proficiencyBonus}
          format={signed}
        />
        <Field
          mode="read"
          label="Hit Point Maximum"
          value={derived.hitPointMaximum}
          format={plain}
        />
        {derived.hitDice.map((pool) => (
          <Field
            key={pool.die}
            mode="read"
            label={`Hit Dice (d${pool.die})`}
            value={pool.total}
            format={plain}
          />
        ))}
      </div>
    </Card>
  );
}

export function AbilitiesSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character || !derived) return <EmptyState>Abilities isn't available yet.</EmptyState>;
  const { definition } = character;

  const saveProficient = new Set(definition.proficiencies.savingThrows);
  const skillLevel = new Map(
    definition.proficiencies.skills.map((skill) => [refKey(skill.ref), skill.level]),
  );
  const skills = [...derived.skills].sort((a, b) => a.ref.name.localeCompare(b.ref.name));

  return (
    <div className="flex flex-col gap-4">
      <Identity character={character} />
      <AbilityScores definition={definition} derived={derived} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Saving Throws">
          <ul className="flex flex-col gap-1">
            {ABILITIES.map((ability) => (
              <ProficiencyRow
                key={ability}
                level={saveProficient.has(ability) ? "proficient" : "none"}
                name={ABILITY_LABEL[ability]}
                modifier={derived.savingThrows[ability]}
              />
            ))}
          </ul>
        </Card>
        <Combat derived={derived} />
      </div>
      <Card title="Skills">
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {skills.map((skill) => (
            <ProficiencyRow
              key={refKey(skill.ref)}
              level={skillLevel.get(refKey(skill.ref)) ?? "none"}
              name={skill.ref.name}
              modifier={skill.modifier}
            />
          ))}
        </ul>
      </Card>
      <Card title="Passive Scores">
        <div className="flex flex-col gap-1">
          {PASSIVE_SKILLS.map((name) => {
            const skill = derived.skills.find((candidate) => candidate.ref.name === name);
            const label = `Passive ${name}`;
            return skill ? (
              <Field key={name} mode="read" label={label} value={skill.passive} format={plain} />
            ) : (
              <div key={name} className="flex items-baseline justify-between gap-2">
                <span className="text-muted text-row">{label}</span>
                <Absent />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
