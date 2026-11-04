import { HOMEBREW_SOURCE } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { parseTags, renderText } from "@dnd/tags";
import { isRecord } from "../../lib/entryGuards.ts";
import { CatalogPicker } from "../CatalogPicker/CatalogPicker.tsx";
import { RemovableChipList } from "../RemovableChipList.tsx";
import { spellTag } from "./monsterSpellcasting.ts";

export interface MonsterSpellListProps {
  /** What the list is, which the picker and each chip's remove button name: `Spellcasting 1 at will`. */
  label: string;
  /** Each spell as stored: a `{@spell}` string, or an entry upstream hides. */
  spells: unknown[];
  edition: CharacterRecord["edition"];
  onSpells: (spells: unknown[]) => void;
}

const spellText = (spell: unknown): string => {
  const text = isRecord(spell) ? spell.entry : spell;
  return typeof text === "string" ? renderText(parseTags(text)) : "";
};

/**
 * One list of a monster's spells: each as a removable chip, and a picker that adds a catalog or
 * homebrew spell. Text written beside a spell, such as `(self only)`, stays on its chip.
 */
export function MonsterSpellList({ label, spells, edition, onSpells }: MonsterSpellListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <RemovableChipList
        items={spells.map((spell, index) => {
          const text = spellText(spell);
          return { key: String(index), label: text, name: `${text} from ${label}` };
        })}
        onRemove={(key) => onSpells(spells.filter((_, at) => String(at) !== key))}
      />
      <CatalogPicker
        label={`Add a spell to ${label}`}
        labelHidden
        edition={edition}
        type="spell"
        placeholder="Add a spell…"
        onPick={(_ref, hit) =>
          onSpells([...spells, spellTag(hit.name, "source" in hit ? hit.source : HOMEBREW_SOURCE)])
        }
      />
    </div>
  );
}
