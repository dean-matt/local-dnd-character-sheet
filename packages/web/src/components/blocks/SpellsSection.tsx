/**
 * The Spells page: the numbers a caster reads before every cast, the slots each level
 * carries, then the spells themselves in one card, grouped by level. Every number comes off the
 * derived block and every spell off `/characters/{id}/spells`, so this file does no
 * rules arithmetic of its own.
 */
import type { SheetSpell } from "@dnd/catalog";
import {
  ABILITY_LABEL,
  type CharacterDerived,
  type CharacterRecord,
  type Derived,
  derivedValue,
  displayName,
  entryKey,
} from "@dnd/character";
import { useCharacterSpells } from "../../hooks/useCharacterSpells.ts";
import {
  castingTime,
  schoolName,
  spellComponents,
  spellDuration,
  spellRange,
} from "../../lib/spellFacts.ts";
import { EmptyState, ErrorState, LoadingState } from "../../states.tsx";
import { signed } from "../Attack.tsx";
import { Card } from "../Card.tsx";
import { Field, OverrideMark } from "../Field.tsx";
import { ListRow } from "../ListRow.tsx";
import { NotFoundTag, renamedAt } from "../NotFoundTag.tsx";
import { firstLine, RulesEntries, RulesText } from "../RulesText.tsx";
import { Tag } from "../Tag.tsx";

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

const levelLabel = (level: number) => (level === 0 ? "Cantrips" : `${ORDINAL[level]} Level`);

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

/** Every pip draws empty: the sheet reads no expended slots yet. */
function SlotRow({
  label,
  spoken = label,
  total,
}: {
  label: string;
  spoken?: string;
  total: Derived<number>;
}) {
  const count = derivedValue(total);
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className="w-12 shrink-0 text-xs">
        {label}
      </span>
      <span className="sr-only">
        {spoken}: {count === 1 ? "1 slot" : `${count} slots`}
      </span>
      <span aria-hidden="true" className="flex grow flex-wrap gap-[3px]">
        {Array.from({ length: count }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: pips are interchangeable.
            key={index}
            className="size-[15px] shrink-0 rounded-full border-[1.5px] border-accent"
          />
        ))}
      </span>
      {total.manual !== null && <OverrideMark computed={String(total.computed)} />}
    </li>
  );
}

function Slots({ derived }: { derived: CharacterDerived }) {
  const { spellSlots, pactSlots } = derived;
  if (spellSlots.length === 0 && !pactSlots) return null;
  return (
    <Card title="Spell Slots">
      <ul className="flex flex-col gap-2.5">
        {spellSlots.map((slot) => (
          <SlotRow key={slot.level} label={levelLabel(slot.level)} total={slot.total} />
        ))}
        {pactSlots && (
          <SlotRow
            label={`Pact ${ORDINAL[pactSlots.level]}`}
            spoken={`Pact Magic, ${levelLabel(pactSlots.level)}`}
            total={pactSlots.total}
          />
        )}
      </ul>
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

/**
 * The die and the type share a chip only where the spell deals one type: the die is the
 * first roll the text prints, so beside two types it would claim both.
 */
function DamageChips({ spell }: { spell: Extract<SheetSpell, { resolved: true }> }) {
  const { damageDice: dice, damageTypes: types = [] } = spell;
  if (dice && types.length === 1) return <Tag>{`${dice} ${types[0]}`}</Tag>;
  return (
    <>
      {dice && <Tag>{dice}</Tag>}
      {types.length > 0 && <Tag>{types.join(", ")}</Tag>}
    </>
  );
}

/** `index` is the spell's place in the definition, which names its field in the report. */
function SpellRow({
  spell,
  index,
  characterId,
}: {
  spell: SheetSpell;
  index: number;
  characterId: string;
}) {
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
      <ListRow
        name={`${spell.name}${source}`}
        chips={
          <>
            {marks}
            <NotFoundTag
              characterId={characterId}
              homebrew={homebrew}
              renamed={renamedAt(`spells[${index}].ref`)}
            />
          </>
        }
      />
    );
  }
  return (
    <ListRow
      name={spell.name}
      chips={
        <>
          <Tag>{schoolName(spell.school)}</Tag>
          <DamageChips spell={spell} />
          {marks}
          {spell.concentration && <Tag>Concentration</Tag>}
          {spell.ritual && <Tag>Ritual</Tag>}
        </>
      }
      preview={firstLine(spell.entries)}
      detail={{
        meta: (
          <span className="flex flex-wrap gap-x-3">
            <Fact label="Casting time" value={castingTime(spell.time)} />
            <Fact label="Range" value={spellRange(spell.range)} />
            <Fact label="Components" value={spellComponents(spell.components)} />
            <Fact label="Duration" value={spellDuration(spell.duration)} />
          </span>
        ),
        children: <RulesEntries entries={spell.entries} />,
      }}
    />
  );
}

/** `index` is the spell's place in the definition. */
type Placed = { spell: SheetSpell; index: number };
type Group = { key: string; title: string; spells: Placed[] };

/** By level, cantrips first, with every reference that resolved to nothing gathered last. */
function groupByLevel(spells: readonly SheetSpell[]): Group[] {
  const byLevel = new Map<number, Placed[]>();
  const missing: Placed[] = [];
  spells.forEach((spell, index) => {
    if (!spell.resolved) {
      missing.push({ spell, index });
      return;
    }
    byLevel.set(spell.level, [...(byLevel.get(spell.level) ?? []), { spell, index }]);
  });
  const groups: Group[] = [...byLevel]
    .sort(([a], [b]) => a - b)
    .map(([level, members]) => ({
      key: String(level),
      title: levelLabel(level),
      spells: members.sort((a, b) => a.spell.name.localeCompare(b.spell.name)),
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
    <Card title="Known Spells">
      <div className="flex flex-col gap-3">
        {groupByLevel(spells.data.spells).map((group) => (
          <div key={group.key}>
            <h4 className="mb-2 font-semibold text-label text-muted uppercase tracking-label">
              {group.title}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {group.spells.map(({ spell, index }) => (
                <SpellRow key={index} spell={spell} index={index} characterId={character.id} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
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
