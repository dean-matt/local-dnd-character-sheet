/**
 * The Attacks & Spellcasting card: a row per equipped weapon, then a row per casting
 * class's spell attack. Every number comes off the derived block; a weapon's name comes
 * off `/characters/{id}/inventory`, since the derived block keys a weapon by its entry.
 */
import {
  type Ability,
  type CharacterDerived,
  type CharacterRecord,
  conditionAttackEffects,
  derivedValue,
  displayName,
  effectsOnRoll,
  entryKey,
  itemKey,
  overrideKey,
  type SpentAmmunition,
  spentAmmunitionOf,
  withAmmunitionSpent,
} from "@dnd/character";
import { useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { useHomebrewNames } from "../../../../hooks/useHomebrewNames.ts";
import { useReplaceDefinitionAndState } from "../../../../hooks/useReplaceDefinitionAndState.ts";
import { editInventoryEntry } from "../../../../lib/editInventoryEntry.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { RollBonusButton } from "../../../RollBonusButton.tsx";
import { RulesText } from "../../../RulesText/RulesText.tsx";
import { damageText } from "../../attack.ts";
import { CastingBlockedNote } from "../../CastingBlockedNote.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";
import { AttackDamage } from "./AttackDamage.tsx";
import { AttackRoll } from "./AttackRoll.tsx";
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

type Attack = CharacterDerived["attacks"][number];

/** The stack an attack spends from: the one picked while it is still a stack, else the first. */
function spendFrom(attack: Attack, picked: number | undefined) {
  const stacks = attack.ammunition?.stacks ?? [];
  return stacks.find(({ entry }) => entry === picked) ?? stacks[0];
}

const leftIn = ({ ammunition }: Attack) =>
  ammunition?.stacks.reduce((total, { quantity }) => total + quantity, 0) ?? 0;

/** Range, the ammunition fired with a count of what is left, and a firearm's reload. */
function weaponNotes(
  attack: Attack,
  ammo: {
    name: (entry: number) => string;
    picked: number | undefined;
    pick: (entry: number) => void;
    recover: (() => void) | undefined;
  },
  refused: string | undefined,
) {
  const { range, ammunition, reload } = attack;
  const from = spendFrom(attack, ammo.picked);
  return (
    <>
      {range && (
        <p className="text-label text-muted">
          Range {range.normal}/{range.long} ft
        </p>
      )}
      {ammunition && (
        <p className="text-label text-muted">
          Ammunition: <RulesText text={`{@item ${ammunition.type}}`} /> ({leftIn(attack)} left)
        </p>
      )}
      {ammunition && ammunition.stacks.length > 1 && from && (
        <label className="flex items-center gap-1 text-label text-muted">
          Spend from
          <select
            value={from.entry}
            onChange={(event) => ammo.pick(Number(event.target.value))}
            className="min-h-6 min-w-0 rounded-control border border-border bg-surface"
          >
            {ammunition.stacks.map(({ entry, quantity }) => (
              <option key={entry} value={entry}>
                {ammo.name(entry)} ({quantity})
              </option>
            ))}
          </select>
        </label>
      )}
      {ammo.recover && (
        <button
          type="button"
          onClick={ammo.recover}
          className="min-h-6 self-start rounded-control border border-border bg-surface px-1 text-label"
        >
          Recover one piece
        </button>
      )}
      {refused && (
        <p role="alert" className="text-error text-label">
          {refused}
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
  const names = useHomebrewNames();
  const inventory = useCharacterInventory(character.id);
  const { definition } = character;
  const rollEffects = derivedValue(derived.rollEffects);
  const replace = useAnnouncedStateWrite(character.id);
  const both = useReplaceDefinitionAndState(character.id);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const play = useCharacterState(character.id);
  const [refused, setRefused] = useState<Record<number, { message: string; left: number }>>({});
  const heldEffects = play.data ? conditionAttackEffects(play.data.state, definition.edition) : [];
  const attackEffects = (ability: Ability) => [
    ...effectsOnRoll(rollEffects, { roll: "attack", ability }),
    ...heldEffects,
  ];
  const weapons = derived.attacks.filter((attack) => definition.inventory[attack.entry]?.equipped);
  const nameOf = (entry: number): string => {
    const ref = definition.inventory[entry]?.ref;
    return inventory.data?.items[entry]?.name ?? (ref ? displayName(ref, names) : "Weapon");
  };

  /** Spends one piece before the attack roll; false, with the reason shown, where none is spent. */
  async function spend(attack: Attack, name: string) {
    const refuse = (message: string) => {
      setRefused((now) => ({ ...now, [attack.entry]: { message, left: leftIn(attack) } }));
      return false;
    };
    const from = spendFrom(attack, picked[attack.entry]);
    const drawn = from && definition.inventory[from.entry];
    const ammunition = attack.ammunition;
    if (!from || !drawn || !ammunition) return refuse(`${name} has no ammunition left to fire.`);
    if (replace.writing) return false;
    setRefused(({ [attack.entry]: _gone, ...rest }) => rest);
    try {
      await both.mutateAsync({
        state: (latest) =>
          withAmmunitionSpent(
            latest,
            { type: ammunition.type, ref: drawn.ref, variant: drawn.variant },
            1,
          ),
        edit: (latest) =>
          editInventoryEntry(latest, from.entry, drawn, (entry) =>
            entry.quantity > 1 ? { ...entry, quantity: entry.quantity - 1 } : null,
          ),
      });
    } catch (error) {
      return refuse(`${name} was not fired: ${(error as Error).message}`);
    }
    if (from.quantity === 1) setPicked(({ [attack.entry]: _gone, ...rest }) => rest);
    replace.announce(`Spent one ${nameOf(from.entry)}, ${leftIn(attack) - 1} left`);
    return true;
  }

  /** Returns one piece to the stack holding that item, or adds a loose one where the last was spent. */
  async function recover(attack: Attack, piece: SpentAmmunition, stack: number | undefined) {
    if (replace.writing) return;
    const drawn = stack === undefined ? undefined : definition.inventory[stack];
    try {
      await both.mutateAsync({
        state: (latest) => withAmmunitionSpent(latest, piece, -1),
        edit: (latest) => {
          if (stack !== undefined && drawn) {
            return editInventoryEntry(latest, stack, drawn, (entry) => ({
              ...entry,
              quantity: entry.quantity + 1,
            }));
          }
          // The record keeps only the item, so a loose piece carries no override, id or container.
          const { ref, variant } = piece;
          return {
            ...latest,
            inventory: [
              ...latest.inventory,
              { ref, variant, quantity: 1, carried: true, equipped: false, attuned: false },
            ],
          };
        },
      });
    } catch (error) {
      replace.announce(`Nothing recovered: ${(error as Error).message}`);
      return;
    }
    replace.announce(`Recovered one ${displayName(piece.ref, names)}, ${leftIn(attack) + 1} left`);
  }

  function recoverer(attack: Attack) {
    if (!attack.ammunition || !play.data) return undefined;
    const piece = spentAmmunitionOf(play.data.state, attack.ammunition.type);
    if (!piece) return undefined;
    const held = attack.ammunition.stacks.find((stack) => {
      const entry = definition.inventory[stack.entry];
      return entry && itemKey(entry) === itemKey(piece);
    });
    return () => recover(attack, piece, held?.entry);
  }

  return (
    <Card title="Attacks & Spellcasting">
      {weapons.length === 0 && derived.spellcasting.length === 0 ? (
        <p className="text-muted text-row">No weapon equipped.</p>
      ) : (
        <table className="w-full table-fixed text-body">
          <colgroup>
            <col />
            <col className="w-[88px]" />
            <col />
            <col className="w-[120px]" />
            <col className="w-6" />
          </colgroup>
          <thead className="font-semibold text-[10px] text-muted uppercase tracking-[0.06em]">
            <tr>
              <th scope="col" className="px-0.5 pb-0.5 text-left">
                Name
              </th>
              <th scope="col" className="px-0.5 pb-0.5 text-left">
                Bonus
              </th>
              <th scope="col" className="px-0.5 pb-0.5 text-left">
                Damage / Type
              </th>
              <th scope="col" className="px-0 pb-0.5">
                <span className="sr-only">Roll attack</span>
              </th>
              <th scope="col" className="px-0 pb-0.5">
                <span className="sr-only">Roll damage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {weapons.map((attack) => {
              const name = nameOf(attack.entry);
              const key = overrideKey("attacks", attack, definition);
              return (
                <AttackRow
                  key={attack.entry}
                  name={name}
                  effects={attackEffects(attack.ability)}
                  notes={
                    <>
                      {attack.mastery.map((ref) => (
                        <p key={`${ref.name}|${ref.source}`} className="text-label text-muted">
                          Mastery: <RulesText text={`{@itemMastery ${ref.name}|${ref.source}}`} />
                        </p>
                      ))}
                      {weaponNotes(
                        attack,
                        {
                          name: nameOf,
                          picked: picked[attack.entry],
                          pick: (entry) => setPicked((now) => ({ ...now, [attack.entry]: entry })),
                          recover: recoverer(attack),
                        },
                        refused[attack.entry]?.left === leftIn(attack)
                          ? refused[attack.entry]?.message
                          : undefined,
                      )}
                    </>
                  }
                  bonus={
                    <DerivedValue
                      named
                      name={`${name} attack bonus`}
                      value={attack.attackBonus}
                      overrideKey={`${key}.attackBonus`}
                    />
                  }
                  rollAttack={
                    <AttackRoll
                      label={`${name} attack`}
                      type="attack"
                      origin={name}
                      bonus={derivedValue(attack.attackBonus)}
                      effects={attackEffects(attack.ability)}
                      beforeRoll={attack.ammunition ? () => spend(attack, name) : undefined}
                    />
                  }
                  rollDamage={
                    attack.damage && (
                      <RollBonusButton
                        label={`${name} damage`}
                        type="damage"
                        origin={name}
                        dice={attack.damage.dice}
                        bonus={derivedValue(attack.damage.modifier)}
                      />
                    )
                  }
                  damage={
                    <AttackDamage name={name} attack={attack} overrideKey={key}>
                      {attack.damage
                        ? `${damageText(attack.damage)} ${attack.damage.type ?? ""}`.trim()
                        : NONE}
                      {critRange(attack)}
                    </AttackDamage>
                  }
                />
              );
            })}
            {derived.spellcasting.map((caster) => {
              const origin = displayName(caster.class, names);
              const name = `${origin} spell attack`;
              return (
                <AttackRow
                  key={entryKey(caster.class)}
                  name={name}
                  bonus={
                    <DerivedValue
                      named
                      name={`${name} bonus`}
                      value={caster.attackBonus}
                      overrideKey={`${overrideKey("spellcasting", caster, definition)}.attackBonus`}
                    />
                  }
                  damage={NONE}
                  rollAttack={
                    <AttackRoll
                      label={name}
                      type="spell-attack"
                      origin={origin}
                      bonus={derivedValue(caster.attackBonus)}
                      effects={attackEffects(caster.ability)}
                    />
                  }
                  effects={attackEffects(caster.ability)}
                  notes={<CastingBlockedNote armor={derived.castingBlockedBy} />}
                />
              );
            })}
          </tbody>
        </table>
      )}
      <WeaponMasteryChoice character={character} derived={derived} />
      <Announcer announced={replace.announced} />
    </Card>
  );
}
