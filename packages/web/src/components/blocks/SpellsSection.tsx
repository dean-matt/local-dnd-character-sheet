/**
 * The Spells page: the numbers a caster reads before every cast, the slots each level
 * carries, then the spells themselves grouped by level. Every number comes off the
 * derived block and every spell off `/characters/{id}/spells`, so this file does no
 * rules arithmetic of its own.
 */
import type { SheetSpell } from "@dnd/catalog";
import {
  ABILITY_LABEL,
  type CharacterDerived,
  type CharacterRecord,
  displayName,
  entryKey,
} from "@dnd/character";
import { type ReactNode, useId, useState } from "react";
import { useCharacterSpells } from "../../hooks/useCharacterSpells.ts";
import {
  castingTime,
  schoolName,
  spellComponents,
  spellDuration,
  spellRange,
} from "../../lib/spellFacts.ts";
import { EmptyState, ErrorState, LoadingState } from "../../states.tsx";
import { Card } from "../Card.tsx";
import { Field } from "../Field.tsx";
import { RulesEntries, RulesText } from "../RulesText.tsx";
import { Tag } from "../Tag.tsx";

const signed = (value: number) => (value < 0 ? `${value}` : `+${value}`);

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

const levelLabel = (level: number) => (level === 0 ? "Cantrips" : `${ORDINAL[level]} level`);

/** One card per casting class, since a multiclassed caster has a DC and a bonus per class. */
function CasterNumbers({ derived }: { derived: CharacterDerived }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {derived.spellcasting.map((caster) => (
        <Card
          key={entryKey(caster.class)}
          title={`${displayName(caster.class)} · ${ABILITY_LABEL[caster.ability]}`}
        >
          <div className="flex flex-col gap-1">
            <Field mode="read" label="Spell Save DC" value={caster.saveDc} format={String} />
            <Field
              mode="read"
              label="Spell Attack Bonus"
              value={caster.attackBonus}
              format={signed}
            />
            {caster.preparedSpells && (
              <Field
                mode="read"
                label="Spells Prepared"
                value={caster.preparedSpells}
                format={String}
              />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Slots({ derived }: { derived: CharacterDerived }) {
  const { spellSlots, pactSlots } = derived;
  if (spellSlots.length === 0 && !pactSlots) return null;
  return (
    <Card title="Spell Slots">
      <div className="flex flex-col gap-1">
        {spellSlots.map((slot) => (
          <Field
            key={slot.level}
            mode="read"
            label={levelLabel(slot.level)}
            value={slot.total}
            format={String}
          />
        ))}
        {pactSlots && (
          <Field
            mode="read"
            label={`Pact Magic, ${levelLabel(pactSlots.level)}`}
            value={pactSlots.total}
            format={String}
          />
        )}
      </div>
    </Card>
  );
}

/** A fact the spell leaves out shows as a dash, spoken as "none". A trigger can carry markup. */
function Fact({ label, value }: { label: string; value: string | undefined }) {
  return (
    <span>
      <span className="sr-only">{label}: </span>
      {value !== undefined ? (
        <RulesText text={value} />
      ) : (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">none</span>
        </>
      )}
      <span className="sr-only">.</span>
    </span>
  );
}

function SpellRow({ spell }: { spell: SheetSpell }) {
  const homebrew = spell.source === undefined;
  const marks = (
    <>
      {homebrew && <Tag>Homebrew</Tag>}
      <Tag>{spell.prepared ? "Prepared" : "Known"}</Tag>
    </>
  );
  if (!spell.resolved) {
    const source = spell.source ? ` (${spell.source})` : "";
    return (
      <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
        <span>
          {spell.name}
          {source}
        </span>
        {marks}
        <span className="text-muted text-row">
          {homebrew ? "Not found in homebrew" : "Not found in the catalog"}
        </span>
      </li>
    );
  }
  return <ResolvedSpellRow spell={spell} marks={marks} />;
}

/**
 * A button rather than a `<details>`: a summary is the disclosure's accessible name, so
 * one holding the facts would read them all on every focus, and a link in a trigger
 * would sit inside a button.
 */
function ResolvedSpellRow({
  spell,
  marks,
}: {
  spell: Extract<SheetSpell, { resolved: true }>;
  marks: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const textId = useId();
  return (
    <li className="py-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen(!open)}
          className="flex cursor-pointer items-baseline gap-2 font-medium"
        >
          <span aria-hidden="true" className={`text-muted print:hidden ${open ? "rotate-90" : ""}`}>
            ▸
          </span>
          {spell.name}
        </button>
        <span className="text-muted text-row">{schoolName(spell.school)}</span>
        {marks}
        {spell.concentration && <Tag>Concentration</Tag>}
        {spell.ritual && <Tag>Ritual</Tag>}
        <span className="flex basis-full flex-wrap gap-x-3 pl-4 text-muted text-row">
          <Fact label="Casting time" value={castingTime(spell.time)} />
          <Fact label="Range" value={spellRange(spell.range)} />
          <Fact label="Components" value={spellComponents(spell.components)} />
          <Fact label="Duration" value={spellDuration(spell.duration)} />
        </span>
      </div>
      <div id={textId} hidden={!open} className="mt-2 flex flex-col gap-2 pl-4">
        {open && <RulesEntries entries={spell.entries} />}
      </div>
    </li>
  );
}

type Group = { key: string; title: string; spells: SheetSpell[] };

/** By level, cantrips first, with every reference that resolved to nothing gathered last. */
function groupByLevel(spells: readonly SheetSpell[]): Group[] {
  const byLevel = new Map<number, SheetSpell[]>();
  const missing: SheetSpell[] = [];
  for (const spell of spells) {
    if (!spell.resolved) {
      missing.push(spell);
      continue;
    }
    byLevel.set(spell.level, [...(byLevel.get(spell.level) ?? []), spell]);
  }
  const groups: Group[] = [...byLevel]
    .sort(([a], [b]) => a - b)
    .map(([level, members]) => ({
      key: String(level),
      title: levelLabel(level),
      spells: members.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  if (missing.length > 0) groups.push({ key: "missing", title: "Not found", spells: missing });
  return groups;
}

function SpellList({ character }: { character: CharacterRecord }) {
  const spells = useCharacterSpells(character.id);
  if (spells.isPending) return <LoadingState label="Loading spells…" />;
  if (spells.isError) return <ErrorState message={spells.error.message} />;
  if (spells.data.spells.length === 0) {
    return <EmptyState>{character.name} has no spells yet.</EmptyState>;
  }
  return (
    <>
      {groupByLevel(spells.data.spells).map((group) => (
        <Card key={group.key} title={group.title}>
          <ul className="divide-y divide-border">
            {group.spells.map((spell, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a spell learned through two classes is listed twice under one name.
              <SpellRow key={index} spell={spell} />
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}

export function SpellsSection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character || !derived) return <EmptyState>Spells isn't available yet.</EmptyState>;
  const casts =
    derived.spellcasting.length > 0 ||
    derived.spellSlots.length > 0 ||
    derived.pactSlots !== null ||
    character.definition.spells.length > 0;
  if (!casts) return <EmptyState>{character.name} doesn't cast spells.</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      <CasterNumbers derived={derived} />
      <Slots derived={derived} />
      <SpellList character={character} />
    </div>
  );
}
