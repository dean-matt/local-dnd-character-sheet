/**
 * The Resistances & Immunities card: what the race and the equipped items grant, read off
 * the derived block. A chip opens a modal naming every source that grants it.
 */
import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../Card.tsx";
import { EmptyNote, PILL } from "../ChipList.tsx";
import { DetailTrigger } from "../DetailTrigger.tsx";

type Defense = CharacterDerived["defenses"]["computed"]["resistances"][number];

type Chip = { label: string; title: string; effect: string; from: string[] };

const capitalized = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const sources = new Intl.ListFormat("en", { type: "conjunction" });

function chips(defenses: readonly Defense[], kind: string, effect: (name: string) => string) {
  return defenses.map(({ name, from }): Chip => {
    const label = capitalized(name);
    return { label, title: `${label} ${kind}`, effect: effect(name), from };
  });
}

function ChipRow({ heading, items }: { heading: string; items: readonly Chip[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
        {heading}
      </h4>
      {items.length === 0 ? (
        <EmptyNote>None.</EmptyNote>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((chip) => (
            // `effect` names both the kind and the type, so no two chips share it.
            <li key={chip.effect}>
              <DetailTrigger
                title={chip.title}
                meta={`From ${sources.format(chip.from)}`}
                detail={<p>{chip.effect}</p>}
                className={`${PILL} block`}
              >
                <span aria-hidden="true">{chip.label}</span>
                <span className="sr-only">{chip.title}</span>
              </DetailTrigger>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Defenses({ derived }: { derived: CharacterDerived }) {
  const { resistances, damageImmunities, conditionImmunities } = derivedValue(derived.defenses);
  return (
    <Card title="Resistances & Immunities">
      <div className="flex flex-col gap-3">
        <ChipRow
          heading="Resistances"
          items={chips(
            resistances,
            "Resistance",
            (name) => `You take half ${name} damage, rounded down.`,
          )}
        />
        <ChipRow
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
