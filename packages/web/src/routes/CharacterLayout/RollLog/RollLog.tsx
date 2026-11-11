import type { RollType, rollLogEntrySchema } from "@dnd/character";
import { Dices } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { EmptyNote } from "../../../components/EmptyNote.tsx";
import { ChipFacet } from "../../../components/Filter/ChipFacet.tsx";
import { FilterButton } from "../../../components/Filter/FilterButton.tsx";
import { type Facet, matchesFacets, useFacetPicks } from "../../../components/Filter/facets.ts";
import { FormField } from "../../../components/FormField.tsx";
import { Select } from "../../../components/Select.tsx";
import { useCharacters } from "../../../hooks/useCharacters.ts";
import { useClearRolls } from "../../../hooks/useClearRolls.ts";
import { useRolls } from "../../../hooks/useRolls.ts";
import { when } from "../../../lib/when.ts";
import { DiceRoller } from "./DiceRoller.tsx";

type Roll = z.infer<typeof rollLogEntrySchema>;

const announcement = (roll: Roll) => `Rolled ${roll.label}: ${roll.total}`;

const TYPE_LABEL: Record<RollType, string> = {
  attack: "Attack",
  damage: "Damage",
  check: "Check",
  save: "Save",
  "spell-attack": "Spell attack",
  "spell-damage": "Spell damage",
  "hit-die": "Hit Die",
  dice: "Rules text",
  custom: "Dice",
};

const FACET_TYPES: readonly RollType[] = [
  "attack",
  "damage",
  "check",
  "save",
  "spell-attack",
  "spell-damage",
  "custom",
];

/** A roll stored before rolls carried a type, or of a type no facet names, matches no pick. */
const TYPE_FACET: Facet<Roll> = {
  key: "type",
  label: "Roll type",
  valuesOf: (roll) => (roll.type && FACET_TYPES.includes(roll.type) ? [TYPE_LABEL[roll.type]] : []),
};

const ALL_CHARACTERS = "";

/**
 * Every character's recent rolls, newest first, each tagged with who rolled it. `latest` is the roll that just landed.
 * The heading takes focus only when the header opened the panel, so a roll keeps focus on the rolled tag.
 * The filter lives in the view, so a reload starts it over. Its Character facet starts at
 * `characterId`, the open character, or at every character without one, and starts over when
 * `characterId` changes. With a character open, a field rolls any notation for it. Clear
 * empties every character's rolls, whatever the filter shows, then focuses the heading,
 * since the button leaves with the last roll. `collapsed` hides all but an icon, keeping the
 * announcement, the filter and the dice field.
 */
export function RollLog({
  latest,
  characterId,
  collapsed,
}: {
  latest: Roll | null;
  characterId?: string;
  collapsed?: boolean;
}) {
  const log = useRolls();
  const clear = useClearRolls();
  const characters = useCharacters();
  const heading = useRef<HTMLHeadingElement>(null);
  const [announced, setAnnounced] = useState("");
  const filter = useFacetPicks();
  const opened = characterId ?? ALL_CHARACTERS;
  const [characterPick, setCharacterPick] = useState({ opened, pick: opened });
  const character = characterPick.opened === opened ? characterPick.pick : opened;
  const pickCharacter = (pick: string) => setCharacterPick({ opened, pick });

  const openedByHeader = useRef(latest === null);
  useEffect(() => {
    if (openedByHeader.current) heading.current?.focus();
  }, []);
  useEffect(() => {
    if (latest) setAnnounced(announcement(latest));
  }, [latest]);

  const rolls = log.data ?? [];
  const shown = rolls.filter(
    (roll) =>
      (character === ALL_CHARACTERS || roll.characterId === character) &&
      matchesFacets(roll, [TYPE_FACET], filter.picks),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <span hidden={!collapsed} className="flex shrink-0 justify-center text-muted">
        <Dices size={18} aria-hidden="true" />
      </span>
      <div hidden={collapsed} className="flex min-h-0 flex-1 flex-col gap-2.5">
        {/* pr-8 clears the dock's Close button, which sits over the panel's top right. */}
        <div className="flex items-center justify-between gap-2 pr-8">
          <h2 ref={heading} tabIndex={-1} className="font-bold text-title">
            Roll Log
          </h2>
          <div className="flex items-center gap-1.5">
            {rolls.length > 0 && (
              <button
                type="button"
                aria-label="Clear Roll Log"
                aria-disabled={clear.isPending || undefined}
                onClick={() => {
                  if (clear.isPending) return;
                  clear.mutate(undefined, { onSuccess: () => heading.current?.focus() });
                }}
                className="rounded-control border border-border px-2 py-0.5 font-semibold text-label text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <FilterButton
              label="Roll Log"
              active={filter.active + (character === ALL_CHARACTERS ? 0 : 1)}
              onReset={() => {
                filter.reset();
                pickCharacter(ALL_CHARACTERS);
              }}
            >
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-label text-muted uppercase tracking-label">
                  Character
                </span>
                {characters.isError && (
                  <p className="text-error text-row">{characters.error.message}</p>
                )}
                {characters.data && (
                  <FormField label="Character" labelHidden>
                    {(control) => (
                      <Select
                        {...control}
                        options={[
                          { value: ALL_CHARACTERS, label: "All characters" },
                          ...characters.data.map(({ id, name }) => ({ value: id, label: name })),
                        ]}
                        value={character}
                        onChange={pickCharacter}
                      />
                    )}
                  </FormField>
                )}
              </div>
              <ChipFacet
                label={TYPE_FACET.label}
                options={FACET_TYPES.map((type) => TYPE_LABEL[type])}
                picked={filter.picks[TYPE_FACET.key] ?? []}
                onChange={(next) => filter.set(TYPE_FACET.key, next)}
              />
            </FilterButton>
          </div>
        </div>
        {clear.isError && (
          <p role="alert" className="text-error text-row">
            {clear.error.message}
          </p>
        )}
        {characterId && <DiceRoller characterId={characterId} />}
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
              className="flex flex-col gap-0.5 rounded-control border border-border px-3 py-2"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-bold">{roll.label}</span>
                <time dateTime={roll.rolledAt} className="shrink-0 text-label text-muted">
                  {when.format(new Date(roll.rolledAt))}
                </time>
              </span>
              {roll.origin && <span className="truncate text-muted text-row">{roll.origin}</span>}
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-1.5 text-muted text-row">
                  {roll.type && (
                    <span className="shrink-0 rounded-control border border-border px-1 font-semibold text-label uppercase tracking-label">
                      {TYPE_LABEL[roll.type]}
                    </span>
                  )}
                  <span className="truncate">
                    {roll.characterName} · {roll.notation}
                  </span>
                </span>
                <strong className="text-title">{roll.total}</strong>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announced}
      </p>
    </div>
  );
}
