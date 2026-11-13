import type { SheetSpell } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  displayName,
  type EntryRef,
} from "@dnd/character";
import { useState } from "react";
import { ErrorState } from "../../../../ErrorState.tsx";
import { characterSpellsKey } from "../../../../hooks/characterKeys.ts";
import { useCharacterSpells } from "../../../../hooks/useCharacterSpells.ts";
import { useHeldSave } from "../../../../hooks/useHeldSave.ts";
import { useHomebrewNames } from "../../../../hooks/useHomebrewNames.ts";
import { useRowWrites } from "../../../../hooks/useRowWrites.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { withSpell } from "../../../../lib/addedEntries.ts";
import { levelLabel } from "../../../../lib/spellLevel.ts";
import { SCHOOLS, schoolName } from "../../../../lib/spellSchool.ts";
import { Card } from "../../../Card.tsx";
import { EmptyNote } from "../../../EmptyNote.tsx";
import { CheckFacet } from "../../../Filter/CheckFacet.tsx";
import { ChipFacet } from "../../../Filter/ChipFacet.tsx";
import { FilterButton } from "../../../Filter/FilterButton.tsx";
import {
  type Facet,
  inRange,
  matchesFacets,
  NO_RANGE,
  useFacetPicks,
} from "../../../Filter/facets.ts";
import { RangeFacet } from "../../../Filter/RangeFacet.tsx";
import { editSpellEntry } from "./editSpellEntry.ts";
import { LearnSpellField } from "./LearnSpellField.tsx";
import { PreparedTallies } from "./PreparedTallies.tsx";
import { SpellRow } from "./SpellRow/SpellRow.tsx";
import { preparedTallies, spellCaster } from "./spellCaster.ts";
import { holdsEvery, ONLY_OPTIONS, TIME_FACET, TIME_OPTIONS } from "./spellFilters.ts";

const SCHOOL_FACET: Facet<SheetSpell> = {
  key: "school",
  label: "School",
  valuesOf: (spell) => (spell.resolved ? [schoolName(spell.school)] : []),
};

const SCHOOL_NAMES = Object.values(SCHOOLS).sort();

/** `index` is the spell's place in the definition. */
type Placed = { spell: SheetSpell; index: number };
type Group = { key: string; title: string; spells: Placed[] };

/** By level, cantrips first, with every reference that resolved to nothing gathered last. */
function groupByLevel(spells: readonly Placed[]): Group[] {
  const byLevel = new Map<number, Placed[]>();
  const missing: Placed[] = [];
  spells.forEach(({ spell, index }) => {
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

/**
 * The spells known, grouped by level, each prepared or unprepared with its toggle and
 * forgotten with ×, and the picker that learns another. Every change saves through the
 * definition, so each lands in the undo log.
 */
export function SpellList({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const names = useHomebrewNames();
  const schools = useFacetPicks();
  const [levels, setLevels] = useState(NO_RANGE);
  const [only, setOnly] = useState<string[]>([]);
  const spells = useCharacterSpells(character.id);
  const write = useHeldSave(character.id, "Spells");
  const { settled, hold, writing } = useRowWrites(characterSpellsKey(character.id));
  const busy = writing || spells.isFetching;
  const casters = derived.spellcasting;
  const drawn = character.definition.spells;
  const edit = (index: number, change: Parameters<typeof editSpellEntry>[3]) => {
    const entry = drawn[index];
    if (!entry || !settled()) return;
    hold(() => write(`row:${index}`, (latest) => editSpellEntry(latest, index, entry, change)));
  };
  const learn = (ref: EntryRef, origin: ContentRef | undefined) =>
    hold(() =>
      write(`learn:${JSON.stringify([ref, origin])}`, (latest) => withSpell(latest, ref, origin)),
    );

  if (spells.isPending) return <LoadingState label="Loading spells…" />;
  if (spells.isError) return <ErrorState error={spells.error} />;
  const list = spells.data.spells;
  const classOf = (spell: SheetSpell) => {
    const caster = casters.length > 1 ? spellCaster(spell, casters) : undefined;
    return caster && displayName(caster.class, names);
  };
  // A cantrip is always ready, a granted spell always prepared, and a class that knows its
  // spells, as a classic Sorcerer does, prepares none.
  const preparable = (spell: SheetSpell) =>
    spell.resolved &&
    spell.level > 0 &&
    !spell.granted &&
    spellCaster(spell, casters)?.preparedSpells !== undefined;
  const active =
    schools.active + (levels.min !== "" || levels.max !== "" ? 1 : 0) + (only.length > 0 ? 1 : 0);
  const shown = list
    .map((spell, index) => ({ spell, index }))
    .filter(
      ({ spell }) =>
        matchesFacets(spell, [SCHOOL_FACET, TIME_FACET], schools.picks) &&
        holdsEvery(spell, only) &&
        inRange(spell.resolved ? spell.level : undefined, levels),
    );
  return (
    <Card
      title="Known Spells"
      action={
        <FilterButton
          label="Known Spells"
          active={active}
          onReset={() => {
            schools.reset();
            setLevels(NO_RANGE);
            setOnly([]);
          }}
        >
          <ChipFacet
            label="School"
            options={SCHOOL_NAMES}
            picked={schools.picks.school ?? []}
            onChange={(next) => schools.set("school", next)}
          />
          <RangeFacet
            label="Spell level"
            range={levels}
            bounds={{ min: 0, max: 9 }}
            onChange={setLevels}
          />
          <CheckFacet
            label={TIME_FACET.label}
            options={TIME_OPTIONS}
            picked={schools.picks.time ?? []}
            onChange={(next) => schools.set("time", next)}
          />
          <CheckFacet label="Show only" options={ONLY_OPTIONS} picked={only} onChange={setOnly} />
        </FilterButton>
      }
    >
      <div className="flex flex-col gap-2">
        <PreparedTallies tallies={preparedTallies(list, casters, names)} />
        {list.length === 0 ? (
          <EmptyNote>{character.name} has no spells yet.</EmptyNote>
        ) : shown.length === 0 ? (
          <EmptyNote>Nothing matches the filter.</EmptyNote>
        ) : (
          groupByLevel(shown).map((group) => (
            <div key={group.key}>
              <h4 className="mb-1.5 font-semibold text-label text-muted uppercase tracking-label">
                {group.title}
              </h4>
              <ul
                aria-busy={busy}
                className="flex flex-col gap-1.5 aria-busy:cursor-wait aria-busy:opacity-60"
              >
                {group.spells.map(({ spell, index }) => (
                  <SpellRow
                    key={index}
                    spell={spell}
                    index={index}
                    characterId={character.id}
                    derived={derived}
                    characterLevel={character.definition.levels.length}
                    className={classOf(spell)}
                    preparable={preparable(spell)}
                    busy={busy}
                    onPrepare={(prepared) => edit(index, (entry) => ({ ...entry, prepared }))}
                    onRemove={() => edit(index, () => null)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
        <LearnSpellField character={character} casters={casters} onLearn={learn} />
      </div>
    </Card>
  );
}
