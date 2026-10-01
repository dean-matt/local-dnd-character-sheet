import { type CharacterDerived, derivedValue } from "@dnd/character";
import { Card } from "../Card.tsx";
import { Field } from "../Field.tsx";
import { DerivedBonus } from "./DerivedBonus.tsx";
import { StatTile } from "./StatTile.tsx";

const COMBAT_LABEL_CLASS = "text-chip tracking-[0.06em]";

export function CombatStats({ derived }: { derived: CharacterDerived }) {
  const extraModes = Object.entries(derivedValue(derived.speed)).filter(
    ([mode]) => mode !== "walk",
  );
  return (
    <Card title="Combat">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Prof." name="Proficiency Bonus" labelClassName={COMBAT_LABEL_CLASS}>
          <DerivedBonus named name="Proficiency Bonus" value={derived.proficiencyBonus} />
        </StatTile>
        <StatTile label="AC" name="Armor Class" labelClassName={COMBAT_LABEL_CLASS}>
          <DerivedBonus named name="Armor Class" value={derived.armorClass} format={String} />
        </StatTile>
        <StatTile label="Init." name="Initiative" labelClassName={COMBAT_LABEL_CLASS}>
          <DerivedBonus named name="Initiative" value={derived.initiative} />
        </StatTile>
        <StatTile label="Speed" name="Speed" labelClassName={COMBAT_LABEL_CLASS}>
          <Field
            mode="read"
            label=""
            labelHidden
            value={derived.speed}
            format={(speed) => String(speed.walk)}
          />
          {extraModes.map(([mode, feet]) => (
            <span key={mode} className="font-normal text-label text-muted">
              {mode} {feet} ft.
            </span>
          ))}
        </StatTile>
      </dl>
    </Card>
  );
}
