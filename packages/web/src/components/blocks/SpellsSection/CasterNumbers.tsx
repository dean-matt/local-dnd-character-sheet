import { ABILITY_LABEL, type CharacterDerived, displayName, entryKey } from "@dnd/character";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { signed } from "../signed.ts";

/** One card per casting class, since a multiclassed caster has a DC and a bonus per class, and a card for what equipped items add to spell damage when they add any. */
export function CasterNumbers({ derived }: { derived: CharacterDerived }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {derived.spellDamageBonus && (
        <Card title="Spell Damage">
          <Field
            mode="read"
            label="Spell Damage Bonus"
            value={derived.spellDamageBonus}
            format={signed}
          />
        </Card>
      )}
      {derived.spellcasting.map((caster) => (
        <Card
          key={entryKey(caster.class)}
          title={`${displayName(caster.class)} · ${ABILITY_LABEL[caster.ability]}`}
        >
          <div className="flex flex-col gap-1">
            <Field mode="read" label="Spell Save DC" value={caster.saveDc} format={String} />
            <Field
              mode="read"
              label="Spell Attack Bonus"
              value={caster.attackBonus}
              format={signed}
            />
            {caster.preparedSpells && (
              <Field
                mode="read"
                label="Spells Prepared"
                value={caster.preparedSpells}
                format={String}
              />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
