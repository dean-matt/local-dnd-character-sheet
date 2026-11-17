import { featGrantsSchema } from "@dnd/catalog";
import {
  ABILITIES,
  type Ability,
  abilityScore,
  type CharacterDefinition,
  type CharacterRecord,
  entryKey,
  type Raise,
} from "@dnd/character";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useFeatRows } from "../../../hooks/useFeatRows.ts";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { alternativesOf, featRow } from "../../../lib/improvementChoice.ts";
import { IncreaseFields } from "../../IncreaseFields.tsx";
import { OfferFields } from "../../OfferFields.tsx";

type Picks = CharacterDefinition["feats"][number]["picks"];

/**
 * The picks a feat's own fields offer — a saving throw, a skill, a tool, a language, a
 * resistance — and, for a feat taken outside an improvement, the increases it offers, each
 * saved as soon as it is picked. A name another slot of the same field holds is not offered
 * again, and a pick stays shown while the list it came from loads or after it leaves it.
 *
 * Each offer is asked on its own, so `Resilient` (XPHB) can store a Constitution save beside
 * a +1 to Strength, where the rules raise the save's ability. Upstream writes no field tying
 * the two; a feat table naming the feats that tie them is the way out.
 */
export function FeatPicks({ character, index }: { character: CharacterRecord; index: number }) {
  const { definition } = character;
  const entry = definition.feats[index];
  const { rows: feats } = useFeatRows(definition.edition);
  const derived = useCharacterDerived(character.id).data;
  const row = entry && featRow(feats, entry.ref);
  const offers = row ? featGrantsSchema.parse(row.json).offers : [];
  const write = useHeldSave(character.id, `${row?.name ?? "Feat"} choice`);
  if (!entry || !row) return null;

  const own = entry.picks?.ability ?? [];
  // Items stay out of the cap, as an improvement's does: a belt setting Strength to 21
  // leaves the score's own room under 20 where it was.
  const totals = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      abilityScore(definition, ability) -
        own.filter((raise) => raise.ability === ability).reduce((sum, r) => sum + r.amount, 0),
    ]),
  ) as Record<Ability, number>;
  const alternatives =
    entry.level === undefined
      ? alternativesOf({ feat: entry.ref, increases: [] }, feats, totals)
      : [];
  const placing = alternatives.length > 1 || alternatives.some((each) => each.slots.length > 0);

  const save = (key: string, change: (picks: Picks) => Picks) =>
    write(key, (latest) => ({
      ...latest,
      feats: latest.feats.map((feat, at) => {
        // The row's position comes from the features query, which lags an add or a removal,
        // so a write lands only on the feat the row was drawn for.
        if (at !== index || entryKey(feat.ref) !== entryKey(entry.ref)) return feat;
        const { picks: _, ...rest } = feat;
        const picks = change(feat.picks);
        return picks && Object.keys(picks).length > 0 ? { ...rest, picks } : rest;
      }),
    }));

  if (offers.length === 0 && !placing) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <OfferFields
        name={row.name}
        edition={definition.edition}
        proficiencies={definition.proficiencies}
        derived={derived}
        offers={offers}
        picks={entry.picks}
        onChange={(slot, change) => save(`feat|${index}|${slot}`, change)}
      />
      {placing && (
        <IncreaseFields
          name={row.name}
          alternatives={alternatives}
          increases={own}
          onChange={(raises: Raise[]) =>
            save(`feat|${index}|ability`, (picks) => {
              const { ability: _, ...rest } = picks ?? {};
              return raises.length > 0 ? { ...rest, ability: raises } : rest;
            })
          }
        />
      )}
    </div>
  );
}
