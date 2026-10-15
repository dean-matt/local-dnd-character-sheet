import type { SheetSpell } from "@dnd/catalog";
import { renamedAt } from "../../../../../lib/renamed.ts";
import { firstLine } from "../../../../../lib/rulesProse.ts";
import {
  castingTime,
  spellComponents,
  spellDuration,
  spellRange,
} from "../../../../../lib/spellFacts.ts";
import { schoolName } from "../../../../../lib/spellSchool.ts";
import { ListRow } from "../../../../ListRow/ListRow.tsx";
import { NotFoundTag } from "../../../../NotFoundTag.tsx";
import { RemoveButton } from "../../../../RemoveButton.tsx";
import { RulesEntries } from "../../../../RulesEntries/RulesEntries.tsx";
import { Tag } from "../../../../Tag.tsx";
import { PreparedToggle } from "./PreparedToggle.tsx";
import { SpellDamageChips } from "./SpellDamageChips.tsx";
import { SpellFact } from "./SpellFact.tsx";

/**
 * `index` is the spell's place in the definition, which names its field in the report.
 * `className` names the class the spell belongs to, where more than one casts. A leveled
 * spell prepares through its toggle; a cantrip, always ready, and a spell nothing resolves
 * carry a mark instead.
 */
export function SpellRow({
  spell,
  index,
  characterId,
  className,
  busy,
  onPrepare,
  onRemove,
}: {
  spell: SheetSpell;
  index: number;
  characterId: string;
  className: string | undefined;
  busy: boolean;
  onPrepare: (prepared: boolean) => void;
  onRemove: () => void;
}) {
  const classTag = className && <Tag>{className}</Tag>;
  const remove = <RemoveButton name={spell.name} onRemove={onRemove} busy={busy} />;
  const mark = <Tag>{spell.prepared ? "Prepared" : "Known"}</Tag>;
  if (!spell.resolved) {
    return (
      <ListRow
        name={spell.name}
        source={spell.source}
        chips={
          <>
            {classTag}
            {mark}
            <NotFoundTag
              characterId={characterId}
              homebrew={spell.source === undefined}
              renamed={renamedAt(`spells[${index}].ref`)}
            />
          </>
        }
        remove={remove}
      />
    );
  }
  const leveled = spell.level > 0;
  return (
    <ListRow
      name={spell.name}
      source={spell.source}
      chips={
        <>
          <Tag>{schoolName(spell.school)}</Tag>
          <SpellDamageChips spell={spell} />
          {classTag}
          {!leveled && mark}
          {spell.concentration && <Tag>Concentration</Tag>}
          {spell.ritual && <Tag>Ritual</Tag>}
        </>
      }
      remove={remove}
      preview={firstLine(spell.entries)}
      controls={
        leveled && (
          <PreparedToggle
            name={spell.name}
            prepared={spell.prepared}
            onChange={onPrepare}
            busy={busy}
          />
        )
      }
      detail={{
        meta: (
          <span className="flex flex-wrap gap-x-3">
            <SpellFact label="Casting time" value={castingTime(spell.time)} />
            <SpellFact label="Range" value={spellRange(spell.range)} />
            <SpellFact label="Components" value={spellComponents(spell.components)} />
            <SpellFact label="Duration" value={spellDuration(spell.duration)} />
          </span>
        ),
        children: <RulesEntries entries={spell.entries} />,
      }}
    />
  );
}
