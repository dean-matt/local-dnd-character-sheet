import type { RollType, rollLogEntrySchema } from "@dnd/character";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { EmptyNote } from "../../../components/EmptyNote.tsx";
import { ChipFacet } from "../../../components/Filter/ChipFacet.tsx";
import { FilterButton } from "../../../components/Filter/FilterButton.tsx";
import { type Facet, matchesFacets, useFacetPicks } from "../../../components/Filter/facets.ts";
import { useRolls } from "../../../hooks/useRolls.ts";

type Roll = z.infer<typeof rollLogEntrySchema>;

const announcement = (roll: Roll) => `Rolled ${roll.label}: ${roll.total}`;

const TYPE_LABEL: Partial<Record<RollType, string>> = {
  attack: "Attack",
  damage: "Damage",
  check: "Check",
  save: "Save",
  "spell-attack": "Spell attack",
  "spell-damage": "Spell damage",
};

/** A roll stored before rolls carried a type, or of a type no facet names, matches no pick. */
const TYPE_FACET: Facet<Roll> = {
  key: "type",
  label: "Roll type",
  valuesOf: (roll) => {
    const label = roll.type && TYPE_LABEL[roll.type];
    return label ? [label] : [];
  },
};

/**
 * Every character's recent rolls, newest first, each tagged with who rolled it. `latest` is the roll that just landed.
 * The heading takes focus only when the header opened the panel, so a roll keeps focus on the rolled tag.
 * The roll type filter lives in the view, so a reload shows the whole log.
 */
export function RollLog({ latest }: { latest: Roll | null }) {
  const log = useRolls();
  const heading = useRef<HTMLHeadingElement>(null);
  const [announced, setAnnounced] = useState("");
  const filter = useFacetPicks();

  const openedByHeader = useRef(latest === null);
  useEffect(() => {
    if (openedByHeader.current) heading.current?.focus();
  }, []);
  useEffect(() => {
    if (latest) setAnnounced(announcement(latest));
  }, [latest]);

  const rolls = log.data ?? [];
  const shown = rolls.filter((roll) => matchesFacets(roll, [TYPE_FACET], filter.picks));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      {/* pr-8 clears the dock's Close button, which sits over the panel's top right. */}
      <div className="flex items-center justify-between gap-2 pr-8">
        <h2 ref={heading} tabIndex={-1} className="font-bold text-title">
          Roll Log
        </h2>
        <FilterButton label="Roll Log" active={filter.active} onReset={filter.reset}>
          <ChipFacet
            label={TYPE_FACET.label}
            options={Object.values(TYPE_LABEL)}
            picked={filter.picks[TYPE_FACET.key] ?? []}
            onChange={(next) => filter.set(TYPE_FACET.key, next)}
          />
        </FilterButton>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
      {log.isError && <p className="text-error text-row">{log.error.message}</p>}
      {log.isSuccess &&
        (rolls.length === 0 ? (
          <EmptyNote>No rolls yet.</EmptyNote>
        ) : (
          shown.length === 0 && <EmptyNote>Nothing matches the filter.</EmptyNote>
        ))}
      <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto p-1">
        {shown.map((roll) => (
          <li
            key={roll.id}
            className="flex items-baseline justify-between gap-2 rounded-control border border-border px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-bold">{roll.label}</span>
              <span className="text-muted text-row">
                {roll.characterName} · {roll.notation}
              </span>
            </span>
            <strong className="text-title">{roll.total}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
