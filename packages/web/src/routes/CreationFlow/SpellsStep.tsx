import type { SearchHit } from "@dnd/catalog";
import { type CharacterDefinition, type EntryRef, entryKey } from "@dnd/character";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogUnavailable } from "../../CatalogUnavailable.tsx";
import { EmptyNote } from "../../components/EmptyNote.tsx";
import { ErrorState } from "../../ErrorState.tsx";
import { useCatalogOutOfDate } from "../../hooks/useCatalogOutOfDate.ts";
import { LoadingState } from "../../LoadingState.tsx";
import { DepartureMark } from "./DepartureMark.tsx";
import { GrantedSpells } from "./GrantedSpells.tsx";
import { SpellPickField } from "./SpellPickField.tsx";
import {
  type CasterFacts,
  cantripsOf,
  SPELLS_FIELD,
  type SubclassPicks,
  spellsOf,
} from "./spellPicks.ts";
import { useSpellChoices } from "./useSpellChoices.ts";

const hitKey = (hit: SearchHit) =>
  entryKey("id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source });

const nameSource = (ref: { name: string; source: string }) => `${ref.name}|${ref.source}`;

/** The `/search` filters narrowing a picker to `list`, or to nothing past the escape. */
const listFilters = (list: ReturnType<typeof useSpellChoices>["list"], offList: boolean) =>
  list && !offList
    ? {
        class: nameSource(list.class),
        ...(list.subclass && { subclass: nameSource(list.subclass) }),
        classLevel: String(list.level),
      }
    : {};

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

/** Adds a pick to the draft's spells, and takes one out. */
function useSpellEdits() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const held = () => getValues("spells") ?? [];
  return {
    add: (ref: EntryRef, prepared: boolean) =>
      setValue("spells", [...held(), { ref, prepared }], { shouldDirty: true }),
    remove: (ref: EntryRef) =>
      setValue(
        "spells",
        held().filter((entry) => entryKey(entry.ref) !== entryKey(ref)),
        { shouldDirty: true },
      ),
  };
}

/**
 * The cantrips and spells a caster starts with, picked from the class's list at the levels
 * its slots cast, beside the spells its rows give outright. Neither the list nor a count is a
 * fence: the escape offers every spell of every level, and a pick past a count is kept, each
 * noted as a departure. A class that casts nothing at its level has nothing to pick.
 */
export function SpellsStep() {
  const { add, remove } = useSpellEdits();
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
    picked,
    subclass,
  } = useSpellChoices();
  const [beyond, setBeyond] = useState(false);
  const catalogOutOfDate = useCatalogOutOfDate();

  if (classless) return <EmptyNote>Choose a class first, and its spells follow.</EmptyNote>;
  if (failed && catalogOutOfDate) return <CatalogUnavailable />;
  if (failed) return <ErrorState message="The spells this step reads failed to load." />;
  if (!tablesReady || !granted) return <LoadingState label="Loading spells…" />;

  const cantrips = cantripsOf(picked);
  const spells = spellsOf(picked);
  const held = new Set(picked.map((spell) => entryKey(spell.ref)));
  const given = new Set(granted.map((spell) => entryKey(spell.ref)));
  const unavailableReason = (hit: SearchHit) => {
    if (given.has(hitKey(hit))) return "Granted already";
    return held.has(hitKey(hit)) ? "Picked already" : undefined;
  };
  const offList = beyond || !facts;
  const filters = listFilters(list, offList);
  const field = { edition, unavailableReason, onRemove: remove };
  const shown = sectionsShown(facts, subclass, cantrips.length, spells.length);

  return (
    <div className="flex flex-col gap-5">
      {!facts && (
        <p className="text-muted text-row">
          {className} doesn't cast spells at level {level}.{" "}
          {subclass.cantrips + subclass.spells > 0
            ? "Pick here only the spells the subclass offers."
            : "Nothing to choose here — select Finish to create the character."}
        </p>
      )}
      <div className="grid gap-7 sm:grid-cols-2">
        <div className="flex flex-col gap-5">
          {shown.cantrips && (
            <SpellPickField
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
          <SpellPickField
            {...field}
            heading={facts?.prepares ? "Spells Prepared" : "Spells Known"}
            noun="spell"
            count={countOf(facts?.spells, subclass.spells, facts !== undefined)}
            picked={spells}
            filters={{
              minLevel: "1",
              maxLevel: String(offList ? 9 : Math.max(1, facts.maxLevel)),
              ...filters,
            }}
            onPick={(ref) => add(ref, facts?.prepares ?? false)}
          />
        )}
      </div>
      {facts && (
        <label className="flex items-center gap-2 text-body">
          <input type="checkbox" checked={beyond} onChange={() => setBeyond(!beyond)} />
          Offer spells off the {className} list, and of any level
        </label>
      )}
      <DepartureMark field={SPELLS_FIELD} />
    </div>
  );
}
