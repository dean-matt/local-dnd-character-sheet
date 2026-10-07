import { z } from "zod";

/**
 * One thing a starting-equipment option hands over:
 *
 * - `item` an `items` row, named and sourced lowercased as upstream writes it, for a
 *   caller to resolve; `label` is upstream's own wording where it gives one, such as a
 *   book that is a prayer book
 * - `special` a thing no row is named for, such as a quill, under the name upstream gives
 * - `type` any one item of a kind, such as a martial weapon, under upstream's
 *   `equipmentType` codes; more than one code lets the player pick across them
 * - `money` coins, in copper pieces
 */
export type EquipmentItem =
  | { kind: "item"; name: string; source: string; quantity: number; label?: string }
  | { kind: "special"; name: string; quantity: number }
  | { kind: "type"; types: string[]; quantity: number }
  | { kind: "money"; copper: number };

/** One way to take a group, under upstream's key for it: `a`, `B`, or `_` for a group given outright. */
type EquipmentOption = { key: string; items: EquipmentItem[] };

/**
 * A row's starting equipment, one group per line of the printed list: a group of one
 * option is given outright, and a group of several is a pick between them.
 * `goldAlternative` is the coins a classic class offers in place of all of it, rolled as
 * `dice` times `multiplier` in gold pieces.
 */
export type StartingEquipment = {
  groups: EquipmentOption[][];
  goldAlternative?: { dice: string; multiplier: number };
};

const quantity = z.int().min(1).optional().catch(undefined);

/** `chain mail|phb` as a name and a source; a reference with no source names no row. */
function itemNamed(ref: string, count = 1, label?: string): EquipmentItem[] {
  const [name, source] = ref.split("|");
  return name && source
    ? [{ kind: "item", name, source, quantity: count, ...(label && { label }) }]
    : [];
}

const money = (copper: number | undefined): EquipmentItem[] =>
  copper ? [{ kind: "money", copper }] : [];

/**
 * One element of an option, read into what it hands over. A pouch holding coins is the
 * pouch and the coins; a special thing's `worthValue` prices it rather than handing coins
 * over, so it is dropped. An element of no shape this reads hands over nothing.
 */
const elementSchema = z.union([
  z.string().transform((ref) => itemNamed(ref)),
  z
    .looseObject({
      item: z.string(),
      quantity,
      displayName: z.string().optional().catch(undefined),
      containsValue: z.int().optional().catch(undefined),
    })
    .transform((element) => [
      ...itemNamed(element.item, element.quantity, element.displayName),
      ...money(element.containsValue),
    ]),
  z
    .looseObject({ special: z.string().min(1), quantity, containsValue: z.int().optional() })
    .transform((element): EquipmentItem[] => [
      { kind: "special", name: element.special, quantity: element.quantity ?? 1 },
      ...money(element.containsValue),
    ]),
  z
    .looseObject({ equipmentType: z.string().min(1), quantity })
    .transform((element): EquipmentItem[] => [
      { kind: "type", types: [element.equipmentType], quantity: element.quantity ?? 1 },
    ]),
  z
    .looseObject({ equipmentTypes: z.array(z.string().min(1)).min(1), quantity })
    .transform((element): EquipmentItem[] => [
      { kind: "type", types: element.equipmentTypes, quantity: element.quantity ?? 1 },
    ]),
  z.looseObject({ value: z.int().min(0) }).transform((element) => money(element.value)),
]);

const groupsSchema = z
  .array(z.record(z.string(), z.array(z.unknown())))
  .optional()
  .catch(undefined)
  .transform((groups) =>
    (groups ?? []).map((group) =>
      Object.entries(group).map(([key, elements]) => ({
        key,
        items: elements.flatMap((element) => elementSchema.safeParse(element).data ?? []),
      })),
    ),
  );

/** `{@dice 5d4 × 10|5d4 × 10|Starting Gold}` as dice and a multiplier; prose of no such shape offers none. */
const goldAlternativeSchema = z
  .string()
  .optional()
  .catch(undefined)
  .transform((text) => {
    const match = /\{@dice (\d+d\d+)(?:\s*×\s*(\d+))?[|}]/.exec(text ?? "");
    return match?.[1] ? { dice: match[1], multiplier: Number(match[2] ?? 1) } : undefined;
  });

/** What a class row hands a character who starts in it. */
export const classStartingEquipmentSchema = z
  .looseObject({
    startingEquipment: z
      .looseObject({ defaultData: groupsSchema, goldAlternative: goldAlternativeSchema })
      .optional()
      .catch(undefined),
  })
  .transform(({ startingEquipment }): StartingEquipment => {
    const gold = startingEquipment?.goldAlternative;
    return { groups: startingEquipment?.defaultData ?? [], ...(gold && { goldAlternative: gold }) };
  });

/** What a background row hands over. A background offers no gold alternative beside its groups. */
export const backgroundStartingEquipmentSchema = z
  .looseObject({ startingEquipment: groupsSchema })
  .transform(({ startingEquipment }): StartingEquipment => ({ groups: startingEquipment }));
