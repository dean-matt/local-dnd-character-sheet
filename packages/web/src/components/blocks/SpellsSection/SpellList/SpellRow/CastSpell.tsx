import type { SheetSpell } from "@dnd/catalog";
import {
  type CharacterDerived,
  type EntryRef,
  type SpellCastOption,
  spellCast,
  spellCastOptions,
} from "@dnd/character";
import { useRef, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../../hooks/useCharacterState.ts";
import { useConcentrationName } from "../../../../../hooks/useConcentrationName.ts";
import { TOGGLE_PILL } from "../../../../../lib/chipStyles.ts";
import { Announcer } from "../../../../Announcer.tsx";
import { CastDialog } from "./CastDialog.tsx";

type Choice = Omit<Parameters<typeof spellCast>[2], "spell">;

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

/**
 * The Cast button of a spell on the sheet and the dialog it opens. The cast's spend and
 * concentration land in one state write, so one undo reverses them, and its outcome is
 * announced once it lands. A cast that changes nothing writes nothing and is announced alone.
 */
export function CastSpell({
  characterId,
  derived,
  spell,
}: {
  characterId: string;
  derived: CharacterDerived;
  spell: Extract<SheetSpell, { resolved: true }>;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const state = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  const stored = state.data?.state;
  const held = useConcentrationName(stored?.concentration ?? null);
  const options: SpellCastOption[] = stored ? spellCastOptions(spell, derived, stored) : [];
  const ref = spellRef(spell);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  async function cast(choice: Choice) {
    if (!stored || !ref) return;
    const { state: after, ended } = spellCast(derived, stored, { spell: ref, ...choice });
    const parts = [castWords(spell.name, choice)];
    if (choice.concentrate) parts.push(`concentrating on ${spell.name}`);
    if (ended && held) parts.push(`${held} ended`);
    const text = parts.join("; ");
    if (after === stored) {
      replace.announce(text);
      close();
    } else if (await replace.write(after, text)) {
      close();
    }
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
