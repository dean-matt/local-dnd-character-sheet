import type { CharacterRecord } from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { Card } from "../../Card.tsx";
import { ChangeablePick } from "./ChangeablePick.tsx";

/**
 * The deity, optional, changed through the picker and stored with its pantheon, which the
 * pill names: two gods can share the rest of their key.
 */
export function DeityCard({ character }: { character: CharacterRecord }) {
  const { deity, edition } = character.definition;
  const write = useHeldSave(character.id, "Deity");
  return (
    <Card title="Deity">
      <ChangeablePick
        noun="deity"
        value={deity ? `${deity.name} · ${deity.pantheon}` : "None"}
        edition={edition}
        type="deity"
        unavailableReason={(hit) =>
          "qualifier" in hit && hit.qualifier ? undefined : "names no pantheon"
        }
        onPick={(ref, hit) => {
          if (!("name" in ref) || !("qualifier" in hit) || !hit.qualifier) return;
          const picked = { ...ref, pantheon: hit.qualifier };
          write("deity", (latest) => ({ ...latest, deity: picked }));
        }}
        onClear={deity && (() => write("deity", ({ deity: _cleared, ...latest }) => latest))}
      />
    </Card>
  );
}
