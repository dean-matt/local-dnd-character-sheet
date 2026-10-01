import type { SheetSpell } from "@dnd/catalog";
import { renamedAt } from "../../lib/renamed.ts";
import { firstLine } from "../../lib/rulesProse.ts";
import { castingTime, spellComponents, spellDuration, spellRange } from "../../lib/spellFacts.ts";
import { schoolName } from "../../lib/spellSchool.ts";
import { ListRow } from "../ListRow.tsx";
import { NotFoundTag } from "../NotFoundTag.tsx";
import { RulesEntries } from "../RulesEntries.tsx";
import { Tag } from "../Tag.tsx";
import { SpellDamageChips } from "./SpellDamageChips.tsx";
import { SpellFact } from "./SpellFact.tsx";

/** `index` is the spell's place in the definition, which names its field in the report. */
export function SpellRow({
  spell,
  index,
  characterId,
}: {
  spell: SheetSpell;
  index: number;
  characterId: string;
}) {
  const homebrew = spell.source === undefined;
  const marks = (
    <>
      {homebrew && <Tag>Homebrew</Tag>}
      <Tag>{spell.prepared ? "Prepared" : "Known"}</Tag>
    </>
  );
  if (!spell.resolved) {
    const source = spell.source ? ` (${spell.source})` : "";
    return (
      <ListRow
        name={`${spell.name}${source}`}
        chips={
          <>
            {marks}
            <NotFoundTag
              characterId={characterId}
              homebrew={homebrew}
              renamed={renamedAt(`spells[${index}].ref`)}
            />
          </>
        }
      />
    );
  }
  return (
    <ListRow
      name={spell.name}
      chips={
        <>
          <Tag>{schoolName(spell.school)}</Tag>
          <SpellDamageChips spell={spell} />
          {marks}
          {spell.concentration && <Tag>Concentration</Tag>}
          {spell.ritual && <Tag>Ritual</Tag>}
        </>
      }
      preview={firstLine(spell.entries)}
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
