import type { SheetSpell } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { EmptyState } from "../../../../EmptyState.tsx";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useCharacterSpells } from "../../../../hooks/useCharacterSpells.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { levelLabel } from "../../../../lib/spellLevel.ts";
import { Card } from "../../../Card.tsx";
import { SpellRow } from "./SpellRow/SpellRow.tsx";

/** `index` is the spell's place in the definition. */
type Placed = { spell: SheetSpell; index: number };
type Group = { key: string; title: string; spells: Placed[] };

/** By level, cantrips first, with every reference that resolved to nothing gathered last. */
function groupByLevel(spells: readonly SheetSpell[]): Group[] {
  const byLevel = new Map<number, Placed[]>();
  const missing: Placed[] = [];
  spells.forEach((spell, index) => {
    if (!spell.resolved) {
      missing.push({ spell, index });
      return;
    }
    byLevel.set(spell.level, [...(byLevel.get(spell.level) ?? []), { spell, index }]);
  });
  const groups: Group[] = [...byLevel]
    .sort(([a], [b]) => a - b)
    .map(([level, members]) => ({
      key: String(level),
      title: levelLabel(level),
      spells: members.sort((a, b) => a.spell.name.localeCompare(b.spell.name)),
    }));
  if (missing.length > 0) groups.push({ key: "missing", title: "Not found", spells: missing });
  return groups;
}

export function SpellList({ character }: { character: CharacterRecord }) {
  const spells = useCharacterSpells(character.id);
  if (spells.isPending) return <LoadingState label="Loading spells…" />;
  if (spells.isError) return <ErrorState error={spells.error} />;
  if (spells.data.spells.length === 0) {
    return <EmptyState>{character.name} has no spells yet.</EmptyState>;
  }
  return (
    <Card title="Known Spells">
      <div className="flex flex-col gap-3">
        {groupByLevel(spells.data.spells).map((group) => (
          <div key={group.key}>
            <h4 className="mb-2 font-semibold text-label text-muted uppercase tracking-label">
              {group.title}
            </h4>
            <ul className="flex flex-col gap-1.5">
              {group.spells.map(({ spell, index }) => (
                <SpellRow key={index} spell={spell} index={index} characterId={character.id} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
