import type { IncreaseAlternative } from "@dnd/catalog";
import { ABILITY_LABEL, type Ability, type CharacterDefinition } from "@dnd/character";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { signed } from "../../components/blocks/signed.ts";
import { ChoicePills } from "./ChoicePills.tsx";
import { increasesOf, type Picks, readPicks, withIncreases } from "./increasePicks.ts";
import type { IncreaseSource } from "./useIncreaseOptions.ts";

const amounts = (alternative: IncreaseAlternative) =>
  alternative.slots.map((slot) => signed(slot.amount)).join(" and ");

const fixedText = (alternative: IncreaseAlternative) =>
  Object.entries(alternative.fixed)
    .map(([ability, amount]) => `${signed(amount ?? 0)} ${ABILITY_LABEL[ability as Ability]}`)
    .join(", ");

/**
 * One race's or background's increases: what it fixes, which way to take them where it
 * offers more than one, and the ability each remaining increase goes to, never one
 * another slot already holds.
 */
export function SourceIncreases({ source }: { source: IncreaseSource }) {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const increases = useWatch<CharacterDefinition, "abilityIncreases">({ name: "abilityIncreases" });
  const { grantedBy, name, alternatives } = source;
  const mine = (increases ?? []).filter((increase) => increase.grantedBy === grantedBy);
  // An alternative with nothing placed reads as the first, and one partly placed can read
  // as another, so the one the player chose is held here and read against alone.
  const [chosen, setChosen] = useState<number>();
  const only = chosen === undefined ? undefined : alternatives[chosen];
  const picks: Picks =
    chosen !== undefined && only !== undefined
      ? { alternative: chosen, slots: readPicks([only], mine)?.slots ?? [] }
      : (readPicks(alternatives, mine) ?? { alternative: 0, slots: [] });
  const alternative = alternatives[picks.alternative];
  if (alternative === undefined) return null;

  const store = (next: Picks) =>
    setValue(
      "abilityIncreases",
      withIncreases(
        getValues("abilityIncreases"),
        grantedBy,
        increasesOf(alternatives, next, grantedBy),
      ),
      { shouldDirty: true },
    );
  const label = grantedBy === "race" ? "Race" : "Background";
  const fixed = fixedText(alternative);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-semibold text-body">
        {label}: {name}
      </h3>
      {fixed && <p className="text-body">{fixed}</p>}
      {alternatives.length > 1 && (
        <ChoicePills
          legend="Increases"
          options={alternatives.map((each, index) => ({
            value: String(index),
            label: amounts(each),
          }))}
          value={String(picks.alternative)}
          onChange={(value) => {
            setChosen(Number(value));
            store({ alternative: Number(value), slots: [] });
          }}
        />
      )}
      {alternative.slots.map((slot, index) => {
        const held = picks.slots[index];
        const elsewhere = picks.slots.filter((_, other) => other !== index);
        return (
          <ChoicePills
            // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position.
            key={index}
            legend={`${label} ${signed(slot.amount)}${alternative.slots.length > 1 ? `, ${index + 1} of ${alternative.slots.length}` : ""}`}
            prompting={held === undefined}
            options={slot.from
              .filter((ability) => !elsewhere.includes(ability))
              .map((ability) => ({ value: ability, label: ABILITY_LABEL[ability] }))}
            value={held}
            onChange={(value) => {
              const slots = alternative.slots.map((_, at) =>
                at === index ? (value as Ability) : picks.slots[at],
              );
              store({ alternative: picks.alternative, slots });
            }}
          />
        );
      })}
    </div>
  );
}
