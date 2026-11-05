import type { CharacterState } from "@dnd/character";
import { levelLabel, ORDINAL } from "../../../../../lib/spellLevel.ts";

/** `key` tells rows apart where two resources share a name. */
export type RestChange = { key: string; label: string; before: string; after: string };

type Slot = NonNullable<CharacterState["pactSlots"]>;

const left = (slot: Slot) => `${slot.total - slot.expended}/${slot.total}`;

/**
 * Each field a rest changes, before and after, in the order the sheet reads them. Both states
 * are measured against the sheet by `sheetState`, so their pools and slots line up one to one;
 * a null current reads as `maximum`. A field the rest leaves alone is omitted.
 */
export function restChanges(
  before: CharacterState,
  after: CharacterState,
  maximum: number,
): RestChange[] {
  const rows: RestChange[] = [
    {
      key: "hitPoints",
      label: "Hit points",
      before: String(before.hitPoints.current ?? maximum),
      after: String(after.hitPoints.current ?? maximum),
    },
    {
      key: "temporary",
      label: "Temporary hit points",
      before: String(before.hitPoints.temporary),
      after: String(after.hitPoints.temporary),
    },
    ...before.hitDice.map((pool, index) => ({
      key: `d${pool.die}`,
      label: `d${pool.die} Hit Dice`,
      before: `${pool.remaining}/${pool.total}`,
      after: `${after.hitDice[index]?.remaining}/${pool.total}`,
    })),
    ...before.spellSlots.map((slot, index) => ({
      key: `slot${slot.level}`,
      label: `${levelLabel(slot.level)} slots`,
      before: left(slot),
      after: left(after.spellSlots[index] ?? slot),
    })),
    ...(before.pactSlots && after.pactSlots
      ? [
          {
            key: "pact",
            label: `Pact Magic ${ORDINAL[before.pactSlots.level]} Level slots`,
            before: left(before.pactSlots),
            after: left(after.pactSlots),
          },
        ]
      : []),
    ...before.resources.map((resource, index) => ({
      key: `resource${index}`,
      label: resource.name,
      before: `${resource.current}/${resource.maximum}`,
      after: `${after.resources[index]?.current}/${resource.maximum}`,
    })),
    {
      key: "exhaustion",
      label: "Exhaustion",
      before: String(before.exhaustion),
      after: String(after.exhaustion),
    },
  ];
  return rows.filter((row) => row.before !== row.after);
}
