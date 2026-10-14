import {
  type CharacterDefinition,
  type CharacterDerived,
  characterDerivedSchema,
} from "@dnd/character";
import { Card } from "../../Card.tsx";
import { DerivedValue } from "../DerivedValue.tsx";
import { SpeedValue } from "./SpeedValue.tsx";
import { StatTile } from "./StatTile.tsx";

const COMBAT_LABEL_CLASS = "text-chip tracking-[0.06em]";

export function CombatStats({
  definition,
  derived,
}: {
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  return (
    <Card title="Combat">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Prof." name="Proficiency Bonus" labelClassName={COMBAT_LABEL_CLASS}>
          <DerivedValue
            named
            name="Proficiency Bonus"
            value={derived.proficiencyBonus}
            overrideKey="proficiencyBonus"
            schema={characterDerivedSchema.shape.proficiencyBonus.shape.computed}
          />
        </StatTile>
        <StatTile label="AC" name="Armor Class" labelClassName={COMBAT_LABEL_CLASS}>
          <DerivedValue
            named
            name="Armor Class"
            value={derived.armorClass}
            format={String}
            overrideKey="armorClass"
          />
        </StatTile>
        <StatTile label="Init." name="Initiative" labelClassName={COMBAT_LABEL_CLASS}>
          <DerivedValue
            named
            name="Initiative"
            value={derived.initiative}
            overrideKey="initiative"
          />
        </StatTile>
        <StatTile label="Speed" name="Speed" labelClassName={COMBAT_LABEL_CLASS}>
          <SpeedValue definition={definition} derived={derived} />
        </StatTile>
      </dl>
    </Card>
  );
}
