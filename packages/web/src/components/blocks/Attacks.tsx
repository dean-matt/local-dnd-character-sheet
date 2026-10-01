/**
 * The Attacks & Spellcasting card: a row per equipped weapon, then a row per casting
 * class's spell attack. Every number comes off the derived block; a weapon's name comes
 * off `/characters/{id}/inventory`, since the derived block keys a weapon by its entry.
 */
import {
  type CharacterDerived,
  type CharacterRecord,
  type Derived,
  derivedValue,
  displayName,
  entryKey,
} from "@dnd/character";
import type { ReactNode } from "react";
import { useCharacterInventory } from "../../hooks/useCharacterInventory.ts";
import { damageText, signed } from "../Attack.tsx";
import { Card } from "../Card.tsx";
import { Popover } from "../Popover.tsx";
import { TermList } from "../TermList.tsx";

const CELL = "px-0.5 py-1.5 text-left align-top";

/** A cell the rules leave empty, shown as a dash and spoken as "none". */
const NONE = (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">None</span>
  </>
);

function Row({ name, bonus, damage }: { name: string; bonus: ReactNode; damage: ReactNode }) {
  return (
    <tr className="border-border border-t">
      <th scope="row" className={`${CELL} truncate font-normal`}>
        {name}
      </th>
      <td className={`${CELL} font-semibold`}>{bonus}</td>
      <td className={`${CELL} text-muted`}>{damage}</td>
    </tr>
  );
}

/** A bonus that opens the terms behind it. */
function Bonus({ name, field }: { name: string; field: Derived<number> }) {
  const bonus = signed(derivedValue(field));
  return (
    <Popover trigger={bonus} triggerLabel={`${name} ${bonus}`} label={name}>
      <TermList terms={field.terms ?? []} />
    </Popover>
  );
}

export function Attacks({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const inventory = useCharacterInventory(character.id);
  const { definition } = character;
  const weapons = derived.attacks.filter((attack) => definition.inventory[attack.entry]?.equipped);
  const nameOf = (entry: number): string => {
    const ref = definition.inventory[entry]?.ref;
    return inventory.data?.items[entry]?.name ?? (ref ? displayName(ref) : "Weapon");
  };
  return (
    <Card title="Attacks & Spellcasting">
      {weapons.length === 0 && derived.spellcasting.length === 0 ? (
        <p className="text-muted text-row">No weapon equipped.</p>
      ) : (
        <table className="w-full table-fixed text-body">
          <colgroup>
            <col />
            <col className="w-[60px]" />
            <col />
          </colgroup>
          <thead className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
            <tr>
              <th scope="col" className="px-0.5 pb-1 text-left">
                Name
              </th>
              <th scope="col" className="px-0.5 pb-1 text-left">
                Bonus
              </th>
              <th scope="col" className="px-0.5 pb-1 text-left">
                Damage / Type
              </th>
            </tr>
          </thead>
          <tbody>
            {weapons.map((attack) => {
              const name = nameOf(attack.entry);
              return (
                <Row
                  key={attack.entry}
                  name={name}
                  bonus={<Bonus name={`${name} attack bonus`} field={attack.attackBonus} />}
                  damage={
                    attack.damage
                      ? `${damageText(attack.damage)} ${attack.damage.type ?? ""}`.trim()
                      : NONE
                  }
                />
              );
            })}
            {derived.spellcasting.map((caster) => {
              const name = `${displayName(caster.class)} spell attack`;
              return (
                <Row
                  key={entryKey(caster.class)}
                  name={name}
                  bonus={<Bonus name={`${name} bonus`} field={caster.attackBonus} />}
                  damage={NONE}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
