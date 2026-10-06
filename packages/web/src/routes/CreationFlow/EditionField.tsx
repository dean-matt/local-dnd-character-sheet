import type { CharacterDefinition } from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { EDITION_LABELS } from "../../lib/editionLabels.ts";
import { useEditionMismatches } from "./useEditionMismatches.ts";

type Edition = CharacterDefinition["edition"];

const EDITIONS = Object.keys(EDITION_LABELS) as Edition[];

/**
 * The rules the character is built under, which decide what every later picker offers. A
 * change keeps each choice already made and names those the new rules do not hold, so the
 * player clears them rather than losing them unseen.
 */
export function EditionField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const edition = useWatch<CharacterDefinition, "edition">({ name: "edition" }) ?? "one";
  const mismatches = useEditionMismatches();
  return (
    <div className="flex flex-col">
      <fieldset className="mt-2 flex flex-col">
        <legend className="mb-1.5 text-muted text-row">Rules</legend>
        <div className="flex w-fit gap-0.5 rounded-pill bg-border p-px">
          {EDITIONS.map((each) => (
            <button
              type="button"
              key={each}
              aria-pressed={each === edition}
              onClick={() => setValue("edition", each, { shouldDirty: true })}
              className="rounded-pill bg-transparent px-3 py-1 font-semibold text-muted text-row hover:text-ink aria-pressed:bg-accent aria-pressed:text-white"
            >
              {EDITION_LABELS[each]}
            </button>
          ))}
        </div>
      </fieldset>
      <div role="status" aria-label="Choices outside the rules">
        {mismatches.length > 0 && (
          <div className="mt-2 rounded-card border border-border bg-surface p-3 text-body">
            <p>
              Not in the {EDITION_LABELS[edition]} rules. Each stays until you clear it, or the race
              or class it belongs to:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {mismatches.map(({ label, value }) => (
                <li key={`${label}: ${value}`}>
                  {label}: {value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
