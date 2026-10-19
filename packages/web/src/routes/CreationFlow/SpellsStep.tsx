import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogUnavailable } from "../../CatalogUnavailable.tsx";
import { EmptyNote } from "../../components/EmptyNote.tsx";
import { PickField } from "../../components/PickField.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useCatalogOutOfDate } from "../../hooks/useCatalogOutOfDate.ts";
import { LoadingState } from "../../LoadingState.tsx";
import type { CasterFacts } from "../../lib/casterFacts.ts";
import { searchHitKey } from "../../lib/searchHitKey.ts";
import { spellListFilters } from "../../lib/spellListFilters.ts";
import { DepartureMark } from "./DepartureMark.tsx";
import { GrantedSpells } from "./GrantedSpells.tsx";
import { NoCastingNote } from "./NoCastingNote.tsx";
import { OwnSpells } from "./OwnSpells.tsx";
import { RowPickList } from "./RowPickList.tsx";
import { SpellBlockChoices } from "./SpellBlockChoices.tsx";
import { StrayPicks } from "./StrayPicks.tsx";
import {
  cantripsOf,
  classPicksOf,
  type PickGrantor,
  SPELLS_FIELD,
  type SubclassPicks,
  spellsOf,
  strayPicks,
} from "./spellPicks.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

/**
 * Which pick lists to draw: those the class casts from, those the subclass offers picks
 * for, and any already holding a pick, so it can be cleared.
 */
function sectionsShown(
  facts: CasterFacts | undefined,
  subclass: SubclassPicks,
  cantrips: number,
  spells: number,
) {
  return {
    cantrips:
      subclass.cantrips > 0 || cantrips > 0 || (facts !== undefined && facts.cantrips !== 0),
    spells: subclass.spells > 0 || spells > 0 || (facts !== undefined && facts.maxLevel > 0),
  };
}

/** A class's count widened by the subclass's picks, `undefined` where none is stated. */
const countOf = (own: number | undefined, subclass: number, casts: boolean) =>
  casts ? (own === undefined ? undefined : own + subclass) : subclass;

/** Adds a pick to the draft's spells, takes one out, and prepares or unprepares one. */
function useSpellEdits() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const held = () => getValues("spells") ?? [];
  return {
    add: (ref: EntryRef, prepared: boolean, pickedFor?: PickGrantor) =>
      setValue("spells", [...held(), { ref, prepared, ...(pickedFor && { pickedFor }) }], {
        shouldDirty: true,
      }),
    remove: (ref: EntryRef) =>
      setValue(
        "spells",
        held().filter((entry) => entryKey(entry.ref) !== entryKey(ref)),
        { shouldDirty: true },
      ),
    toggle: (ref: EntryRef) =>
      setValue(
        "spells",
        held().map((entry) =>
          entryKey(entry.ref) === entryKey(ref) ? { ...entry, prepared: !entry.prepared } : entry,
        ),
        { shouldDirty: true },
      ),
  };
}

/** The escape's label, naming every list it lifts: the class's where it casts, and each row's offer. */
function escapeLabel(casts: boolean, className: string, rows: boolean) {
  if (casts && rows) {
    return `Offer spells off the ${className} list and outside what each row offers, and of any level`;
  }
  if (casts) return `Offer spells off the ${className} list, and of any level`;
  return rows ? "Offer spells outside what each row offers" : undefined;
}

/**
 * The cantrips and spells a caster starts with, picked from the class's list at the levels
 * its slots cast, beside the spells its rows give outright. Neither the list nor a count is a
 * fence: the escape offers every spell of every level, and a pick past a count is kept, each
 * noted as a departure. A class that casts nothing at its level has nothing to pick of its
 * own. A class keeping a spellbook, as a 2014 wizard, fills the book first and prepares from
 * it. A race, background, feat or optional feature offering picks gets fields of its own,
 * held to its count and offer rather than the class's.
 */
export function SpellsStep() {
  const { add, remove, toggle } = useSpellEdits();
  const edition = useWatch<CharacterDefinition, "edition">({ name: "edition" }) ?? "one";
  const {
    tablesReady,
    failed,
    classless,
    className,
    level,
    facts,
    list,
    granted,
    offers,
    picked,
    subclass,
    rows,
  } = useSpellChoices();
  const [beyond, setBeyond] = useState(false);
  const catalogOutOfDate = useCatalogOutOfDate();

  if (classless) return <EmptyNote>Choose a class first, and its spells follow.</EmptyNote>;
  if (failed && catalogOutOfDate) return <CatalogUnavailable />;
  if (failed) return <ErrorState message="The spells this step reads failed to load." />;
  if (!tablesReady || !granted) return <LoadingState label="Loading spells…" />;

  const own = classPicksOf(picked);
  const cantrips = cantripsOf(own);
  const spells = spellsOf(own);
  const held = new Set(picked.map((spell) => entryKey(spell.ref)));
  const given = new Set(granted.map((spell) => entryKey(spell.ref)));
  const unavailableReason = (hit: SearchHit) => {
    if (given.has(searchHitKey(hit))) return "Granted already";
    return held.has(searchHitKey(hit)) ? "Picked already" : undefined;
  };
  const offList = beyond || !facts;
  const filters = spellListFilters(list, offList);
  const field = { edition, unavailableReason, onRemove: remove };
  const shown = sectionsShown(facts, subclass, cantrips.length, spells.length);
  const offersAny = subclass.cantrips + subclass.spells > 0 || rows.length > 0;
  const escapeText = escapeLabel(facts !== undefined, className, rows.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {!facts && <NoCastingNote className={className} level={level} offersAny={offersAny} />}
      <div className="grid gap-7 sm:grid-cols-2">
        <div className="flex flex-col gap-5">
          {shown.cantrips && (
            <PickField
              {...field}
              heading="Cantrips"
              noun="cantrip"
              count={countOf(facts?.cantrips, subclass.cantrips, facts !== undefined)}
              picked={cantrips}
              filters={{ minLevel: "0", maxLevel: "0", ...filters }}
              onPick={(ref) => add(ref, false)}
            />
          )}
          <GrantedSpells granted={granted} />
        </div>
        {shown.spells && (
          <OwnSpells
            field={field}
            facts={facts}
            count={countOf(facts?.spells, subclass.spells, facts !== undefined)}
            spells={spells}
            filters={{
              minLevel: "1",
              maxLevel: String(offList ? 9 : Math.max(1, facts.maxLevel)),
              ...filters,
            }}
            add={add}
            toggle={toggle}
          />
        )}
      </div>
      <SpellBlockChoices offers={offers} />
      <StrayPicks strays={strayPicks(picked, rows)} onRemove={remove} />
      <RowPickList
        rows={rows}
        field={field}
        offList={beyond}
        // A row's spell is always ready, so it lands prepared whatever the class does.
        onPick={(ref, pickedFor) => add(ref, true, pickedFor)}
      />
      {escapeText && (
        <label className="flex items-center gap-2 text-body">
          <input type="checkbox" checked={beyond} onChange={() => setBeyond(!beyond)} />
          {escapeText}
        </label>
      )}
      <DepartureMark field={SPELLS_FIELD} />
    </div>
  );
}
