import type { SearchHit } from "@dnd/catalog";
import { type CharacterDerived, type CharacterRecord, derivedValue, refKey } from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { PILL } from "../../../../lib/chipStyles.ts";
import { CatalogPicker } from "../../../CatalogPicker/CatalogPicker.tsx";
import { SaveFailure } from "../../../SaveFailure.tsx";

/**
 * The weapon kinds a character has mastery with, as many as the classes' Weapon Mastery
 * allows. A pick past the limit is never refused, only reported, as attunement is: a table
 * may allow more, and a player mid-swap holds one over for a moment. Removing one is always
 * open, which is how the choice changes after a long rest.
 */
export function WeaponMasteryChoice({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const chosen = character.definition.weaponMasteries;
  const limit = derivedValue(derived.weaponMasteryLimit);
  if (limit === 0 && chosen.length === 0) return null;

  const taken = new Set(chosen.map(refKey));
  const unavailable = (hit: SearchHit) => {
    if ("id" in hit || !hit.item?.mastery) return "Not a base weapon with a mastery property";
    return taken.has(refKey(hit)) ? "Already chosen" : undefined;
  };

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-border border-t pt-2.5">
      <h4 className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
        Weapon mastery
      </h4>
      <p className="text-row">
        {chosen.length} of {limit} chosen
      </p>
      {chosen.length > limit && (
        <p role="status" className="text-error text-row">
          Over the limit: remove {chosen.length - limit} to match what your classes allow.
        </p>
      )}
      <ul className="flex flex-wrap gap-1.5">
        {chosen.map((kind) => (
          <li key={refKey(kind)} className={`${PILL} flex items-center gap-1.5`}>
            {kind.name}
            <button
              type="button"
              aria-label={`Remove ${kind.name}`}
              onClick={() =>
                update.mutate((latest) => ({
                  ...latest,
                  weaponMasteries: latest.weaponMasteries.filter(
                    (each) => refKey(each) !== refKey(kind),
                  ),
                }))
              }
              className="text-muted hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {chosen.length < limit && (
        <CatalogPicker
          label="Choose a weapon to master"
          edition={character.definition.edition}
          type="item"
          filters={{ kind: "melee,ranged" }}
          unavailableReason={unavailable}
          onPick={(ref) =>
            "name" in ref &&
            update.mutate((latest) => ({
              ...latest,
              weaponMasteries: [...latest.weaponMasteries, ref],
            }))
          }
        />
      )}
      {update.isError && (
        <p role="alert" className="text-error text-row">
          <SaveFailure
            message={`Couldn't save the weapon mastery: ${update.error.message} `}
            onRetry={() => update.variables && update.mutate(update.variables)}
          />
        </p>
      )}
    </div>
  );
}
