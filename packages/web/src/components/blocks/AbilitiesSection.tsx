/**
 * The numbers a player reads constantly. Every number comes off the derived block; the
 * definition supplies only what a player chose — the scores and which saves and skills
 * they are proficient in. A value with terms opens them in a popover.
 */
import {
  ABILITIES,
  ABILITY_LABEL,
  type Ability,
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterRecord,
  type Derived,
  derivedValue,
  refKey,
} from "@dnd/character";
import type { ReactNode } from "react";
import { EmptyState } from "../../states.tsx";
import { Card } from "../Card.tsx";
import { Field } from "../Field.tsx";
import { Popover } from "../Popover.tsx";
import { TermList } from "../TermList.tsx";

type ProficiencyLevel = CharacterDefinition["proficiencies"]["skills"][number]["level"];

/** The three passive scores a table asks for, looked up by the skill's name in either edition. */
const PASSIVE_SKILLS = ["Perception", "Insight", "Investigation"];

const PROFICIENCY_MARK: Record<ProficiencyLevel, { text: string; className: string }> = {
  none: { text: "Not proficient", className: "border-muted" },
  half: {
    text: "Half proficiency",
    className: "border-accent bg-[linear-gradient(90deg,var(--color-accent)_50%,transparent_50%)]",
  },
  proficient: { text: "Proficient", className: "border-accent bg-accent" },
  expertise: {
    text: "Expertise",
    className: "border-accent bg-accent shadow-[inset_0_0_0_2px_var(--color-surface)]",
  },
};

const signed = (value: number) => (value < 0 ? `${value}` : `+${value}`);

/** A value the rules leave unset, shown as a dash and spoken as "none" rather than as zero. */
function Absent() {
  return (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">None</span>
    </span>
  );
}

function Ring({ level }: { level: ProficiencyLevel }) {
  const mark = PROFICIENCY_MARK[level];
  return (
    <span
      aria-hidden="true"
      title={mark.text}
      className={`size-[13px] shrink-0 rounded-full border-[1.5px] ${mark.className}`}
    />
  );
}

/** A derived number, behind a popover of its terms where the rules supplied any. */
function Bonus({
  name,
  value,
  format = signed,
  named = false,
}: {
  name: string;
  value: Derived<number>;
  format?: (value: number) => string;
  /** The surrounding term or row already names the value, so the field stays unlabeled rather than repeat it. */
  named?: boolean;
}) {
  const field = (
    <Field mode="read" label={named ? "" : name} labelHidden value={value} format={format} />
  );
  const terms = value.terms ?? [];
  if (terms.length === 0) return field;
  return (
    <Popover
      trigger={field}
      triggerLabel={`${name} ${format(derivedValue(value))}`}
      label={`${name} breakdown`}
    >
      <TermList terms={terms} />
    </Popover>
  );
}

/** One row of a proficiency list: the ring a reader checks as often as the total, then the total. */
function ProficiencyRow({
  level,
  name,
  label,
  ability,
  modifier,
}: {
  level: ProficiencyLevel;
  name: string;
  label?: string;
  ability?: Ability;
  modifier: Derived<number>;
}) {
  return (
    <li className="flex items-center gap-2 py-0.5 text-body">
      <Ring level={level} />
      <span className="flex-1">
        {label ? (
          <>
            <span aria-hidden="true">{label}</span>
            <span className="sr-only">{name}</span>
          </>
        ) : (
          name
        )}
        {level !== "none" && (
          <span className="sr-only">, {PROFICIENCY_MARK[level].text.toLowerCase()}</span>
        )}
      </span>
      {ability && (
        <span className="w-6.5 text-label text-muted uppercase">
          <span aria-hidden="true">{ability}</span>
          <span className="sr-only">{ABILITY_LABEL[ability]}</span>
        </span>
      )}
      <span className="flex w-7 justify-end font-semibold">
        <Bonus named name={ability ? `${name} check` : `${name} save`} value={modifier} />
      </span>
    </li>
  );
}

/** Spells out the marks a title tooltip alone would hide from a keyboard or touch reader. */
function Legend() {
  return (
    <p aria-hidden="true" className="flex flex-wrap items-center gap-x-3 text-muted text-row">
      {(Object.keys(PROFICIENCY_MARK) as ProficiencyLevel[]).map((level) => (
        <span key={level} className="flex items-center gap-1">
          <Ring level={level} />
          {PROFICIENCY_MARK[level].text}
        </span>
      ))}
      <span>* Overridden</span>
    </p>
  );
}

/** One stat on the subtle fill: a tracked label above the value. */
function Tile({
  label,
  name,
  labelClassName,
  children,
}: {
  label: string;
  name: string;
  labelClassName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-control bg-subtle px-1 py-2">
      <dt className={`font-semibold text-muted uppercase ${labelClassName}`}>
        <span aria-hidden="true">{label}</span>
        <span className="sr-only">{name}</span>
      </dt>
      <dd className="flex flex-col items-center font-bold text-number">{children}</dd>
    </div>
  );
}

const ABILITY_LABEL_CLASS = "text-[10px] tracking-[0.06em]";
const COMBAT_LABEL_CLASS = "text-chip tracking-[0.06em]";

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
          <Tile
            key={ability}
            label={ability}
            name={ABILITY_LABEL[ability]}
            labelClassName={ABILITY_LABEL_CLASS}
          >
            <span>{definition.abilityScores[ability]}</span>
            <span className="sr-only">, </span>
            <span className="rounded-pill bg-accent px-2 font-semibold text-label text-white [&_.text-accent]:text-white">
              <Field
                mode="read"
                label="modifier"
                labelHidden
                value={derived.abilityModifiers[ability]}
                format={signed}
              />
            </span>
          </Tile>
        ))}
      </dl>
    </Card>
  );
}

function Combat({ derived }: { derived: CharacterDerived }) {
  const extraModes = Object.entries(derivedValue(derived.speed)).filter(
    ([mode]) => mode !== "walk",
  );
  return (
    <Card title="Combat">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="Prof." name="Proficiency Bonus" labelClassName={COMBAT_LABEL_CLASS}>
          <Bonus named name="Proficiency Bonus" value={derived.proficiencyBonus} />
        </Tile>
        <Tile label="AC" name="Armor Class" labelClassName={COMBAT_LABEL_CLASS}>
          <Bonus named name="Armor Class" value={derived.armorClass} format={String} />
        </Tile>
        <Tile label="Init." name="Initiative" labelClassName={COMBAT_LABEL_CLASS}>
          <Bonus named name="Initiative" value={derived.initiative} />
        </Tile>
        <Tile label="Speed" name="Speed" labelClassName={COMBAT_LABEL_CLASS}>
          <Field
            mode="read"
            label=""
            labelHidden
            value={derived.speed}
            format={(speed) => String(speed.walk)}
          />
          {extraModes.map(([mode, feet]) => (
            <span key={mode} className="font-normal text-label text-muted">
              {mode} {feet} ft.
            </span>
          ))}
        </Tile>
      </dl>
    </Card>
  );
}

/** Passive Perception first, since it is the one a table asks for; the others follow in its footer. */
function PassiveFooter({ derived }: { derived: CharacterDerived }) {
  return (
    <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-border border-t pt-2 text-muted text-row">
      {PASSIVE_SKILLS.map((name) => {
        const skill = derived.skills.find((candidate) => candidate.ref.name === name);
        return (
          <div key={name} className="flex items-baseline gap-1">
            <dt>Passive {name}</dt>
            <dd className="font-semibold text-ink">
              {skill ? (
                <Field
                  mode="read"
                  label="score"
                  labelHidden
                  value={skill.passive}
                  format={String}
                />
              ) : (
                <Absent />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
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
      <AbilityScores definition={definition} derived={derived} />
      <Combat derived={derived} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card title="Saving Throws">
          <ul className="flex flex-col gap-1">
            {ABILITIES.map((ability) => (
              <ProficiencyRow
                key={ability}
                level={saveProficient.has(ability) ? "proficient" : "none"}
                name={ABILITY_LABEL[ability]}
                label={ability.toUpperCase()}
                modifier={derived.savingThrows[ability]}
              />
            ))}
          </ul>
        </Card>
        <Card title="Skills">
          <ul className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
            {skills.map((skill) => (
              <ProficiencyRow
                key={refKey(skill.ref)}
                level={skillLevel.get(refKey(skill.ref)) ?? "none"}
                name={skill.ref.name}
                ability={skill.ability}
                modifier={skill.modifier}
              />
            ))}
          </ul>
          <PassiveFooter derived={derived} />
        </Card>
      </div>
      <Legend />
    </div>
  );
}
