import {
  type CharacterDefinition,
  type CharacterDerived,
  characterDerivedSchema,
  derivedValue,
  effectsOnRoll,
} from "@dnd/character";
import { useConditionEffects } from "../../../hooks/useConditionEffects.ts";
import { Card } from "../../Card.tsx";
import { DerivedValue } from "../DerivedValue.tsx";
import { RollEffectChip } from "../RollEffectChip.tsx";
import { SpeedValue } from "./SpeedValue.tsx";
import { StatTile } from "./StatTile.tsx";

const COMBAT_LABEL_CLASS = "text-chip tracking-[0.06em]";

export function CombatStats({
  characterId,
  definition,
  derived,
}: {
  characterId: string;
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  const conditions = useConditionEffects(characterId, definition, "initiative");
  const initiative = effectsOnRoll([...derivedValue(derived.rollEffects), ...conditions], {
    roll: "initiative",
  });
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
          <RollEffectChip roll="Initiative" effects={initiative} />
        </StatTile>
        <StatTile label="Speed" name="Speed" labelClassName={COMBAT_LABEL_CLASS}>
          <SpeedValue characterId={characterId} definition={definition} derived={derived} />
        </StatTile>
      </dl>
    </Card>
  );
}
