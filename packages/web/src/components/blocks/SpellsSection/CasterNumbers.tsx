import {
  ABILITY_LABEL,
  type CharacterDerived,
  type CharacterRecord,
  characterDerivedSchema,
  displayName,
  entryKey,
  overrideKey,
} from "@dnd/character";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { Card } from "../../Card.tsx";
import { DerivedValue } from "../DerivedValue.tsx";
import { LabeledValue } from "../LabeledValue.tsx";

const { spellcasting } = characterDerivedSchema.shape;

/** One card per casting class, since a multiclassed caster has a DC and a bonus per class, and a card for what equipped items add to spell damage when they add any. */
export function CasterNumbers({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const names = useHomebrewNames();
  return (
    <>
      {derived.spellDamageBonus && (
        <Card title="Spell Damage">
          <LabeledValue label="Spell Damage Bonus">
            <DerivedValue
              named
              name="Spell Damage Bonus"
              value={derived.spellDamageBonus}
              overrideKey="spellDamageBonus"
            />
          </LabeledValue>
        </Card>
      )}
      {derived.spellcasting.map((caster) => {
        const key = overrideKey("spellcasting", caster, character.definition);
        const name = displayName(caster.class, names);
        return (
          <Card key={entryKey(caster.class)} title={`${name} · ${ABILITY_LABEL[caster.ability]}`}>
            <div className="flex flex-col gap-0.5">
              <LabeledValue label="Spell Save DC">
                <DerivedValue
                  named
                  name={`${name} Spell Save DC`}
                  value={caster.saveDc}
                  format={String}
                  overrideKey={`${key}.saveDc`}
                />
              </LabeledValue>
              <LabeledValue label="Spell Attack Bonus">
                <DerivedValue
                  named
                  name={`${name} Spell Attack Bonus`}
                  value={caster.attackBonus}
                  overrideKey={`${key}.attackBonus`}
                />
              </LabeledValue>
              {caster.preparedSpells && (
                <LabeledValue label="Spells Prepared">
                  <DerivedValue
                    named
                    name={`${name} Spells Prepared`}
                    value={caster.preparedSpells}
                    format={String}
                    overrideKey={`${key}.preparedSpells`}
                    schema={spellcasting.element.shape.preparedSpells.unwrap().shape.computed}
                  />
                </LabeledValue>
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}
