/**
 * The Resistances & Immunities card: what the race and the equipped items grant, read off
 * the derived block. A chip opens a modal naming every source that grants it.
 */
import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../../../Card.tsx";
import { capitalize } from "../../capitalize.ts";
import { DefenseChipRow, type DefenseChipRowProps } from "./DefenseChipRow.tsx";

type Defense = CharacterDerived["defenses"]["computed"]["resistances"][number];

type Chip = DefenseChipRowProps["items"][number];

const options = new Intl.ListFormat("en", { type: "disjunction" });

function chips(defenses: readonly Defense[], kind: string, effect: (name: string) => string) {
  return defenses.map(({ name, from }): Chip => {
    const label = capitalize(name);
    return { label, title: `${label} ${kind}`, effect: effect(name), from };
  });
}

export function Defenses({ derived }: { derived: CharacterDerived }) {
  const { resistances, damageImmunities, conditionImmunities, vulnerabilities, resistanceChoice } =
    derivedValue(derived.defenses);
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
          note={
            resistanceChoice
              ? `${resistanceChoice.from} offers ${options.format(resistanceChoice.options)}, not yet chosen.`
              : undefined
          }
        />
        <DefenseChipRow
          heading="Immunities"
          items={[
            ...chips(damageImmunities, "Immunity", (name) => `You take no ${name} damage.`),
            ...chips(
              conditionImmunities,
              "Immunity",
              (name) => `${capitalize(name)} can't affect you.`,
            ),
          ]}
        />
        {vulnerabilities.length > 0 && (
          <DefenseChipRow
            heading="Vulnerabilities"
            items={chips(
              vulnerabilities,
              "Vulnerability",
              (name) => `You take double ${name} damage.`,
            )}
          />
        )}
      </div>
    </Card>
  );
}
