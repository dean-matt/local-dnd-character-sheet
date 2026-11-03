import { HOMEBREW_SOURCE, homebrewDeityRecordSchema } from "@dnd/catalog";
import type { CharacterRecord, DeityRef } from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useHomebrew } from "../../../hooks/useHomebrew.ts";
import { deityOf, deityUnavailable } from "../../../lib/deityPick.ts";
import { Card } from "../../Card.tsx";
import { NotFoundTag } from "../../NotFoundTag.tsx";
import { ChangeablePick } from "./ChangeablePick.tsx";

/**
 * The deity, optional, changed through the picker and stored with its pantheon, which the
 * pill names: two gods can share the rest of their key.
 */
export function DeityCard({ character }: { character: CharacterRecord }) {
  const { deity, edition } = character.definition;
  const write = useHeldSave(character.id, "Deity");
  const missing = useHomebrewDeityMissing(deity);
  return (
    <Card
      title="Deity"
      aside={
        missing && <NotFoundTag characterId={character.id} homebrew renamed={() => undefined} />
      }
    >
      <ChangeablePick
        noun="deity"
        value={deity ? `${deity.name} · ${deity.pantheon}` : "None"}
        edition={edition}
        type="deity"
        unavailableReason={deityUnavailable}
        onPick={(_ref, hit) => {
          const picked = deityOf(hit);
          if (picked) write("deity", (latest) => ({ ...latest, deity: picked }));
        }}
        onClear={deity && (() => write("deity", ({ deity: _cleared, ...latest }) => latest))}
      />
    </Card>
  );
}

/**
 * Whether `deity` cites a homebrew deity the loaded list lacks, matched as the table's unique
 * index matches, ignoring case. Nothing is missing while the list loads.
 */
function useHomebrewDeityMissing(deity: DeityRef | undefined): boolean {
  const homebrew = deity?.source === HOMEBREW_SOURCE;
  const rows = useHomebrew("deities", homebrewDeityRecordSchema, { listed: homebrew }).list.data;
  if (!homebrew || rows === undefined) return false;
  const key = (d: { name: string; pantheon: string }) => `${d.name}\0${d.pantheon}`.toLowerCase();
  return !rows.some((row) => key(row) === key(deity));
}
