/**
 * The Resistances & Immunities card: what the race and the equipped items grant, read off
 * the derived block. A chip opens a modal naming every source that grants it.
 */
import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../Card.tsx";
import { DefenseChipRow, type DefenseChipRowProps } from "./DefenseChipRow.tsx";

type Defense = CharacterDerived["defenses"]["computed"]["resistances"][number];

type Chip = DefenseChipRowProps["items"][number];

const capitalized = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

function chips(defenses: readonly Defense[], kind: string, effect: (name: string) => string) {
  return defenses.map(({ name, from }): Chip => {
    const label = capitalized(name);
    return { label, title: `${label} ${kind}`, effect: effect(name), from };
  });
}

export function Defenses({ derived }: { derived: CharacterDerived }) {
  const { resistances, damageImmunities, conditionImmunities } = derivedValue(derived.defenses);
  return (
    <Card title="Resistances & Immunities">
      <div className="flex flex-col gap-3">
        <DefenseChipRow
          heading="Resistances"
          items={chips(
            resistances,
            "Resistance",
            (name) => `You take half ${name} damage, rounded down.`,
          )}
        />
        <DefenseChipRow
          heading="Immunities"
          items={[
            ...chips(damageImmunities, "Immunity", (name) => `You take no ${name} damage.`),
            ...chips(
              conditionImmunities,
              "Immunity",
              (name) => `${capitalized(name)} can't affect you.`,
            ),
          ]}
        />
      </div>
    </Card>
  );
}
