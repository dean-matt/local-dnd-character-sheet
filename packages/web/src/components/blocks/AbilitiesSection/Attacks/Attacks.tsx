/**
 * The Attacks & Spellcasting card: a row per equipped weapon, then a row per casting
 * class's spell attack. Every number comes off the derived block; a weapon's name comes
 * off `/characters/{id}/inventory`, since the derived block keys a weapon by its entry.
 */
import {
  type CharacterDerived,
  type CharacterRecord,
  derivedValue,
  displayName,
  effectsOnRoll,
  entryKey,
} from "@dnd/character";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { Card } from "../../../Card.tsx";
import { RulesText } from "../../../RulesText/RulesText.tsx";
import { damageText } from "../../attack.ts";
import { AttackBonus } from "./AttackBonus.tsx";
import { AttackRow } from "./AttackRow.tsx";
import { WeaponMasteryChoice } from "./WeaponMasteryChoice.tsx";

/** A cell the rules leave empty, shown as a dash and spoken as "none". */
const NONE = (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">None</span>
  </>
);

/** Beside the damage only where an item lowers the number a critical hit needs, so the usual 20 adds nothing. */
function critRange({ critThreshold }: CharacterDerived["attacks"][number]) {
  const lowest = derivedValue(critThreshold);
  return lowest < 20 ? ` · Crit ${lowest}–20` : null;
}

/** Range, the ammunition fired with a count of what is carried, and a firearm's reload. */
function weaponNotes(attack: CharacterDerived["attacks"][number]) {
  const { range, ammunition, reload } = attack;
  return (
    <>
      {range && (
        <p className="text-label text-muted">
          Range {range.normal}/{range.long} ft
        </p>
      )}
      {ammunition && (
        <p className="text-label text-muted">
          Ammunition: <RulesText text={`{@item ${ammunition.type}}`} /> ({ammunition.carried}{" "}
          carried)
        </p>
      )}
      {reload && <p className="text-label text-muted">Reload {reload}</p>}
    </>
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
  const effects = effectsOnRoll(derivedValue(derived.rollEffects), { roll: "attack" });
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
                <AttackRow
                  key={attack.entry}
                  name={name}
                  effects={effects}
                  notes={
                    <>
                      {attack.mastery.map((ref) => (
                        <p key={`${ref.name}|${ref.source}`} className="text-label text-muted">
                          Mastery: <RulesText text={`{@itemMastery ${ref.name}|${ref.source}}`} />
                        </p>
                      ))}
                      {weaponNotes(attack)}
                    </>
                  }
                  bonus={<AttackBonus name={`${name} attack bonus`} field={attack.attackBonus} />}
                  damage={
                    <>
                      {attack.damage
                        ? `${damageText(attack.damage)} ${attack.damage.type ?? ""}`.trim()
                        : NONE}
                      {critRange(attack)}
                    </>
                  }
                />
              );
            })}
            {derived.spellcasting.map((caster) => {
              const name = `${displayName(caster.class)} spell attack`;
              return (
                <AttackRow
                  key={entryKey(caster.class)}
                  name={name}
                  bonus={<AttackBonus name={`${name} bonus`} field={caster.attackBonus} />}
                  damage={NONE}
                  effects={effects}
                />
              );
            })}
          </tbody>
        </table>
      )}
      <WeaponMasteryChoice character={character} derived={derived} />
    </Card>
  );
}
