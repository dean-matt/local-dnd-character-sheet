import type { SheetSpell } from "@dnd/catalog";
import {
  type CharacterDerived,
  derivedValue,
  type EntryRef,
  entryKey,
  type SpellCastOption,
  spellCast,
  spellCastOptions,
  spellDamageDice,
} from "@dnd/character";
import { useRef, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../../hooks/useCharacterState.ts";
import { useConcentrationName } from "../../../../../hooks/useConcentrationName.ts";
import { useRollAndRecord } from "../../../../../hooks/useRollAndRecord.ts";
import { TOGGLE_PILL } from "../../../../../lib/chipStyles.ts";
import { Announcer } from "../../../../Announcer.tsx";
import { CastDialog } from "./CastDialog.tsx";

type Choice = Omit<Parameters<typeof spellCast>[2], "spell"> & { roll: boolean };

type Rolled = { total: number; natural20: boolean; logged: boolean };

function castWords(name: string, { option, spend }: Choice) {
  if (option.via === "cantrip") return `Cast ${name}`;
  if (option.via === "ritual") return `Cast ${name} as a ritual`;
  const slot = option.via === "pact" ? "the pact slot" : `a level ${option.level} slot`;
  if (!spend) return `Cast ${name} at level ${option.level}, spending no slot`;
  return `Cast ${name} with ${slot}, ${(option.left ?? 1) - 1} left`;
}

const spellRef = (spell: SheetSpell): EntryRef | undefined => {
  if (spell.source) return { name: spell.name, source: spell.source };
  return spell.homebrewId ? { homebrewId: spell.homebrewId } : undefined;
};

/** The class's attack bonus where the spell names its class, else the first casting class's; undefined for a character with none. */
function attackBonus(derived: CharacterDerived, spell: SheetSpell) {
  const key = spell.origin && entryKey(spell.origin);
  const caster =
    derived.spellcasting.find((each) => entryKey(each.class) === key) ?? derived.spellcasting[0];
  return caster && derivedValue(caster.attackBonus);
}

const signed = (bonus: number) => (bonus < 0 ? `${bonus}` : `+${bonus}`);

/**
 * The Cast button of a spell on the sheet and the dialog it opens. The cast's spend and
 * concentration land in one state write, so one undo reverses them, and its outcome is
 * announced once it lands. A cast that changes nothing writes nothing and is announced alone.
 * The dialog can add the spell's attack and damage rolls, made at the level it is cast at, or
 * at the character's level for a cantrip, and logged once the cast lands; a natural 20 on the
 * attack is announced as a critical hit.
 */
export function CastSpell({
  characterId,
  derived,
  spell,
  characterLevel,
}: {
  characterId: string;
  derived: CharacterDerived;
  characterLevel: number;
  spell: Extract<SheetSpell, { resolved: true }>;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const state = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  const stored = state.data?.state;
  const held = useConcentrationName(stored?.concentration ?? null);
  const attackRoll = useRollAndRecord(characterId);
  const damageRoll = useRollAndRecord(characterId);
  const bonus = spell.attack ? attackBonus(derived, spell) : undefined;
  const rolls =
    bonus !== undefined || spellDamageDice(spell, spell.level, characterLevel) !== undefined;
  const options: SpellCastOption[] = stored ? spellCastOptions(spell, derived, stored) : [];
  const ref = spellRef(spell);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function rolled(
    hook: typeof attackRoll,
    notation: string,
    label: string,
    type: "spell-attack" | "spell-damage",
  ) {
    return new Promise<Rolled | undefined>((resolve) => {
      const failed = hook.roll(notation, { label, type, origin: spell.name }, (made, logged) =>
        resolve({
          total: made.total,
          natural20: made.dice[0]?.value === 20 && type === "spell-attack",
          logged,
        }),
      );
      if (failed) resolve(undefined);
    });
  }

  async function rollParts(choice: Choice) {
    const level = choice.option.level;
    const notation = spellDamageDice(spell, level, characterLevel);
    const [hit, damage] = await Promise.all([
      bonus === undefined
        ? undefined
        : rolled(attackRoll, `1d20${signed(bonus)}`, `${spell.name} attack`, "spell-attack"),
      notation === undefined
        ? undefined
        : rolled(damageRoll, notation, `${spell.name} damage`, "spell-damage"),
    ]);
    const words = (name: string, roll: Rolled | undefined) =>
      roll && `${name} ${roll.total}${roll.logged ? "" : ", not logged"}`;
    return [
      words("attack", hit),
      hit?.natural20 ? "critical hit" : undefined,
      words("damage", damage),
    ].filter((part) => part !== undefined);
  }

  async function announceRolls(choice: Choice, text: string) {
    const results = await rollParts(choice);
    if (results.length > 0) replace.announce(`${text}; ${results.join(", ")}`);
  }

  async function cast(choice: Choice) {
    if (!stored || !ref) return;
    const { state: after, ended } = spellCast(derived, stored, { spell: ref, ...choice });
    const parts = [castWords(spell.name, choice)];
    if (choice.concentrate) parts.push(`concentrating on ${spell.name}`);
    if (ended && held) parts.push(`${held} ended`);
    const text = parts.join("; ");
    if (after === stored) replace.announce(text);
    else if (!(await replace.write(after, text))) return;
    close();
    if (choice.roll) await announceRolls(choice, text);
  }

  if (!ref) return null;
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`Cast ${spell.name}`}
        aria-disabled={!stored || undefined}
        onClick={() => stored && setOpen(true)}
        className={`${TOGGLE_PILL} border-border bg-surface text-ink`}
      >
        Cast
      </button>
      {open && (
        <CastDialog
          name={spell.name}
          level={spell.level}
          concentration={spell.concentration}
          rolls={rolls}
          options={options}
          held={held}
          busy={replace.writing}
          error={replace.error?.message}
          onCast={cast}
          onClose={close}
        />
      )}
      <Announcer announced={replace.announced} />
    </>
  );
}
