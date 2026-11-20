/**
 * The Attacks & Spellcasting card: a row per equipped weapon, the off-hand attack of a
 * second light weapon, an unarmed strike for every character, then a row per casting class's spell attack. Every number comes off the derived
 * block; a weapon's name comes off `/characters/{id}/inventory`, since the derived block keys a weapon by its entry.
 * Where an item deals extra damage by a target's alignment, the damage cell asks for the target's alignment, since an attack carries no target.
 * Damage a feature offers is taken by checkbox, and its slot or once-a-turn use is spent before the damage roll.
 */
import { alignmentName } from "@dnd/catalog";
import {
  type Ability,
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  conditionRollEffects,
  derivedValue,
  displayName,
  effectsOnRoll,
  entryKey,
  featureDamageDice,
  featuresUsed,
  houseRule,
  itemKey,
  offerSlots,
  overrideKey,
  type SpellCastOption,
  type SpentAmmunition,
  slotSpent,
  spellCastOptions,
  spentAmmunitionOf,
  usedThisTurn,
  withAmmunitionSpent,
} from "@dnd/character";
import { type ComponentProps, type ReactNode, useContext, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { useHomebrewNames } from "../../../../hooks/useHomebrewNames.ts";
import { useReplaceDefinitionAndState } from "../../../../hooks/useReplaceDefinitionAndState.ts";
import { editInventoryEntry } from "../../../../lib/editInventoryEntry.ts";
import { rollTerms } from "../../../../lib/rollTerms.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { RollBonusButton } from "../../../RollBonusButton.tsx";
import { RulesText } from "../../../RulesText/RulesText.tsx";
import { RollingFor } from "../../../rollerContext.ts";
import { damageText, tradeKey } from "../../attack.ts";
import { CastingBlockedNote } from "../../CastingBlockedNote.tsx";
import { DerivedValue } from "../../DerivedValue.tsx";
import { AttackDamage } from "./AttackDamage.tsx";
import { AttackRoll } from "./AttackRoll.tsx";
import { AttackRow } from "./AttackRow.tsx";
import { AttackTrades } from "./AttackTrades.tsx";
import { FeatureDamage } from "./FeatureDamage.tsx";
import { WeaponMasteryChoice } from "./WeaponMasteryChoice.tsx";

/** A cell the rules leave empty, shown as a dash and spoken as "none". */
const NONE = (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">None</span>
  </>
);

type Attack = CharacterDerived["attacks"][number];

/** Beside the damage only where an item lowers the number a critical hit needs, so the usual 20 adds nothing. */
function critRange({ critThreshold }: Pick<Attack, "critThreshold">) {
  const lowest = derivedValue(critThreshold);
  return lowest < 20 ? ` · Crit ${lowest}–20` : null;
}

/** The table's flanking rule for a weapon that states no range, which the sheet takes for melee; a thrown weapon states one and is offered none. */
function meleeFlanking(attack: Attack, definition: CharacterRecord["definition"]) {
  return attack.ammunition || attack.range ? undefined : houseRule(definition, "flanking");
}

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

const addUp = (taken: Attack["options"], part: "attack" | "damage", from: number) =>
  taken.reduce((sum, option) => sum + option[part], from);

/** The attack roll's bonus and logged terms with each trade taken added as its own term. */
function tradedAttack(field: Attack["attackBonus"], taken: Attack["options"]) {
  const terms = rollTerms(field);
  return {
    bonus: addUp(taken, "attack", derivedValue(field)),
    terms: terms && [
      ...terms,
      ...taken.flatMap(({ source, attack }) => (attack === 0 ? [] : [{ source, value: attack }])),
    ],
  };
}

type SlotPick = { slot?: SpellCastOption; versus: boolean };
const NO_SMITE: SlotPick = { versus: false };

/**
 * The state after paying for the damage features taken on a row: the slot each smite takes and
 * the once-a-turn uses, with words for what was spent; or why it could not be paid.
 */
function featureSpend(
  derived: CharacterDerived,
  latest: CharacterState,
  taken: Attack["featureDamage"],
  pickFor: (entry: Attack["featureDamage"][number]) => SlotPick,
): { after: CharacterState; text: string } | { refused: string } {
  const once = taken.filter(({ offer }) => offer?.oncePerTurn).map(({ source }) => source);
  const slotWords: string[] = [];
  let after = featuresUsed(latest, once);
  for (const entry of taken.filter(({ offer }) => offer?.slot)) {
    const { slot } = pickFor(entry);
    if (!slot) continue;
    try {
      after = slotSpent(derived, after, slot);
      slotWords.push(`a level ${slot.level} slot on ${entry.source}`);
    } catch (error) {
      return { refused: `${entry.source} was not used: ${(error as Error).message}` };
    }
  }
  const words = [...slotWords, ...once.map((source) => `${source} this turn`)];
  return { after, text: `Used ${words.join(" and ")}` };
}

/** The slot the player picked while it is still left, else the lowest left. */
const pickedSlot = (slots: readonly SpellCastOption[], picked: SpellCastOption | undefined) =>
  slots.find((option) => option.via === picked?.via && option.level === picked.level) ?? slots[0];

/**
 * What a row's feature damage adds to its damage roll: the offers taken and not used up this
 * turn, nor wanting a slot where none is left, and the dice and flat bonus of those and of
 * what always lands.
 */
function rowFeatureDamage(
  features: Attack["featureDamage"],
  chosen: readonly string[],
  used: (entry: Attack["featureDamage"][number]) => boolean,
  pickFor: (entry: Attack["featureDamage"][number]) => SlotPick,
) {
  const taken = features.filter(
    (entry) =>
      entry.offer &&
      !used(entry) &&
      (!entry.offer.slot || pickFor(entry).slot) &&
      chosen.includes(entry.source),
  );
  const landing = [...features.filter((entry) => !entry.offer), ...taken];
  return {
    taken,
    dice: landing
      .map((entry) => featureDamageDice(entry, pickFor(entry).slot?.level, pickFor(entry).versus))
      .flatMap((dice) => (dice ? [`+${dice}`] : []))
      .join(""),
    bonus: landing.reduce((sum, { bonus }) => sum + bonus, 0),
  };
}

export function Attacks({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const names = useHomebrewNames();
  const rolling = useContext(RollingFor) !== null;
  const inventory = useCharacterInventory(character.id);
  const { definition } = character;
  const rollEffects = derivedValue(derived.rollEffects);
  const replace = useAnnouncedStateWrite(character.id);
  const both = useReplaceDefinitionAndState(character.id);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const play = useCharacterState(character.id);
  const [target, setTarget] = useState<Record<string, string>>({});
  const [crit, setCrit] = useState<Record<string, boolean>>({});
  const setCritical = (key: string, on: boolean) => setCrit((now) => ({ ...now, [key]: on }));
  const [traded, setTraded] = useState<Record<string, readonly string[]>>({});
  const [refused, setRefused] = useState<Record<number, { message: string; left: number }>>({});
  const [adding, setAdding] = useState<Record<string, readonly string[]>>({});
  const [smite, setSmite] = useState<Record<string, Record<string, SlotPick>>>({});
  const slots: SpellCastOption[] = play.data
    ? spellCastOptions({ level: 1, ritual: false }, derived, play.data.state).filter(
        ({ left }) => left !== null && left > 0,
      )
    : [];
  const usedNow = (entry: Attack["featureDamage"][number]) =>
    entry.offer?.oncePerTurn === true &&
    play.data !== undefined &&
    usedThisTurn(play.data.state, entry.source);
  const heldEffects = play.data ? conditionRollEffects(play.data.state, definition, "attack") : [];
  const attackEffects = (ability: Ability) => [
    ...effectsOnRoll(rollEffects, { roll: "attack", ability }),
    ...heldEffects,
  ];
  const unarmed = derived.unarmedStrike;
  const offHand = derived.offHandAttack;
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

  /**
   * What the row's feature damage adds to its roll, the slot each smite on it would spend, and
   * the spend to run before the roll where what is taken costs a slot or a turn's use.
   */
  function rowDamage(rowKey: string, features: Attack["featureDamage"]) {
    const chosen = adding[rowKey] ?? [];
    const pickFor = ({ source, offer }: Attack["featureDamage"][number]): SlotPick => {
      const own = smite[rowKey]?.[source] ?? NO_SMITE;
      return { ...own, slot: pickedSlot(offerSlots(slots, offer), own.slot) };
    };
    const added = rowFeatureDamage(features, chosen, usedNow, pickFor);
    const spends = added.taken.some(({ offer }) => offer?.slot || offer?.oncePerTurn);
    return {
      pickFor,
      added,
      spend: spends ? () => spendFeatures(added.taken, pickFor) : undefined,
    };
  }

  /** Clears the trades and feature damage taken on a row, once its damage is logged. */
  function clearTaken(rowKey: string) {
    setTraded((now) => ({ ...now, [rowKey]: [] }));
    setAdding((now) => ({ ...now, [rowKey]: [] }));
  }

  /** The feature damage controls of one row, the slot each smite would spend among them. */
  function featureCell(
    rowKey: string,
    { damage, featureDamage }: Pick<Attack, "damage" | "featureDamage">,
    pickFor: (entry: Attack["featureDamage"][number]) => SlotPick,
  ) {
    const pick = (source: string, change: Partial<SlotPick>) =>
      setSmite((now) => ({
        ...now,
        [rowKey]: {
          ...now[rowKey],
          [source]: { ...(now[rowKey]?.[source] ?? NO_SMITE), ...change },
        },
      }));
    return (
      <FeatureDamage
        entries={damage ? featureDamage : []}
        rolling={rolling}
        taken={adding[rowKey] ?? []}
        take={(source, on) =>
          setAdding((now) => {
            const rest = (now[rowKey] ?? []).filter((name) => name !== source);
            return { ...now, [rowKey]: on ? [...rest, source] : rest };
          })
        }
        used={usedNow}
        slots={slots}
        pickFor={pickFor}
        pickSlot={(source, slot) => pick(source, { slot })}
        setVersus={(source, on) => pick(source, { versus: on })}
      />
    );
  }

  /** Writes what the damage features taken on a row cost; false, with the reason spoken, where it could not. */
  async function spendFeatures(
    taken: Attack["featureDamage"],
    pickFor: (entry: Attack["featureDamage"][number]) => SlotPick,
  ) {
    const latest = play.data?.state;
    if (!latest) return false;
    const spend = featureSpend(derived, latest, taken, pickFor);
    if ("refused" in spend) {
      replace.announce(spend.refused);
      return false;
    }
    return spend.after === latest || replace.write(spend.after, spend.text);
  }

  /**
   * One weapon-shaped row: the bonus, the attack and damage rolls, and the critical-hit flag
   * and the feature trades the two share. A trade taken stays taken until a damage roll is
   * logged, so a miss carries it to the next attack; so does feature damage taken.
   */
  function strikeRow({
    key,
    name,
    rowKey,
    ability,
    attack,
    flanking,
    beforeRoll,
    notes,
  }: {
    key: string | number;
    name: string;
    rowKey: string;
    ability: Ability;
    attack: Pick<
      Attack,
      "attackBonus" | "critThreshold" | "damage" | "extraDamage" | "featureDamage" | "options"
    >;
    flanking: ComponentProps<typeof AttackRoll>["flanking"];
    beforeRoll?: () => Promise<boolean>;
    notes?: ReactNode;
  }) {
    const { damage } = attack;
    const extras = attack.extraDamage ?? [];
    const struck = extras.filter(({ targetAlignment }) => targetAlignment === target[rowKey]);
    const alignments = [...new Set(extras.map(({ targetAlignment }) => targetAlignment))];
    const chosen = alignments.includes(target[rowKey] ?? "") ? (target[rowKey] ?? "") : "";
    const { options } = attack;
    const taken = options.filter((option) => traded[rowKey]?.includes(tradeKey(option)));
    const take = (trade: Attack["options"][number], on: boolean) =>
      setTraded((now) => {
        const sameSource = new Set(
          options.filter(({ source }) => source === trade.source).map(tradeKey),
        );
        const rest = (now[rowKey] ?? []).filter((other) => !sameSource.has(other));
        return { ...now, [rowKey]: on ? [...rest, tradeKey(trade)] : rest };
      });
    const { pickFor, added, spend } = rowDamage(rowKey, attack.featureDamage);
    return (
      <AttackRow
        key={key}
        name={name}
        effects={attackEffects(ability)}
        notes={notes}
        bonus={
          <DerivedValue
            named
            name={`${name} attack bonus`}
            value={attack.attackBonus}
            overrideKey={`${rowKey}.attackBonus`}
          />
        }
        rollAttack={
          <AttackRoll
            label={`${name} attack`}
            type="attack"
            origin={name}
            {...tradedAttack(attack.attackBonus, taken)}
            effects={attackEffects(ability)}
            beforeRoll={beforeRoll}
            critAt={Math.min(
              derivedValue(attack.critThreshold),
              ...taken.map(({ critical }) => critical ?? 20),
            )}
            flanking={flanking}
            onRolled={(hit) => setCritical(rowKey, hit)}
          />
        }
        rollDamage={
          damage && (
            <RollBonusButton
              label={`${name} damage${struck.map(({ dice, type }) => ` and ${dice} ${type}`).join("")}${[...taken, ...added.taken].map(({ source }) => ` with ${source}`).join("")}`}
              type="damage"
              origin={name}
              dice={`${damage.dice}${struck.map(({ dice }) => `+${dice}`).join("")}${added.dice}`}
              bonus={addUp(taken, "damage", derivedValue(damage.modifier)) + added.bonus}
              critical={crit[rowKey] ?? false}
              beforeRoll={spend}
              onRolled={(_hit, logged) => {
                setCritical(rowKey, false);
                if (logged) clearTaken(rowKey);
              }}
            />
          )
        }
        damage={
          <>
            <AttackDamage name={name} attack={attack} overrideKey={rowKey}>
              {damage ? `${damageText(damage)} ${damage.type ?? ""}`.trim() : NONE}
              {critRange(attack)}
            </AttackDamage>
            {damage && rolling && (
              <label className="flex items-center gap-1 text-label">
                <input
                  type="checkbox"
                  checked={crit[rowKey] ?? false}
                  onChange={(event) => setCritical(rowKey, event.target.checked)}
                />
                Critical hit
              </label>
            )}
            {damage && rolling && <AttackTrades options={options} taken={taken} take={take} />}
            {featureCell(rowKey, attack, pickFor)}
            {damage && rolling && alignments.length > 0 && (
              <label className="flex items-center gap-1 text-label">
                Target alignment
                <select
                  value={chosen}
                  onChange={(event) =>
                    setTarget((now) => ({ ...now, [rowKey]: event.target.value }))
                  }
                  className="min-h-6 min-w-0 rounded-control border border-border bg-surface"
                >
                  <option value="">Other</option>
                  {alignments.map((code) => (
                    <option key={code} value={code}>
                      {alignmentName(code)} (
                      {extras
                        .filter(({ targetAlignment }) => targetAlignment === code)
                        .map(({ dice, type }) => `+${dice} ${type}`)
                        .join(", ")}
                      )
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        }
      />
    );
  }

  return (
    <Card title="Attacks & Spellcasting">
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
            return strikeRow({
              key: attack.entry,
              name,
              rowKey: overrideKey("attacks", attack, definition),
              ability: attack.ability,
              attack,
              flanking: meleeFlanking(attack, definition),
              beforeRoll: attack.ammunition ? () => spend(attack, name) : undefined,
              notes: (
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
              ),
            });
          })}
          {offHand &&
            strikeRow({
              key: "off-hand",
              name: `${nameOf(offHand.entry)} (off-hand)`,
              rowKey: "offHandAttack",
              ability: offHand.ability,
              attack: offHand,
              flanking: meleeFlanking(offHand, definition),
              notes: <p className="font-semibold text-label">Bonus action</p>,
            })}
          {strikeRow({
            key: "unarmed",
            name: "Unarmed Strike",
            rowKey: "unarmedStrike",
            ability: "str",
            attack: unarmed,
            flanking: houseRule(definition, "flanking"),
          })}
          {derived.spellcasting.map((caster) => {
            const origin = displayName(caster.class, names);
            const name = `${origin} spell attack`;
            const spellKey = `spell:${entryKey(caster.class)}`;
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
                    terms={rollTerms(caster.attackBonus)}
                    effects={attackEffects(caster.ability)}
                    critAt={20}
                    onRolled={(hit) => setCritical(spellKey, hit)}
                  />
                }
                effects={attackEffects(caster.ability)}
                notes={
                  <>
                    {crit[spellKey] && <p className="font-semibold text-label">Critical hit</p>}
                    <CastingBlockedNote armor={derived.castingBlockedBy} />
                  </>
                }
              />
            );
          })}
        </tbody>
      </table>
      <WeaponMasteryChoice character={character} derived={derived} />
      <Announcer announced={replace.announced} />
    </Card>
  );
}
