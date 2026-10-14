import { type CharacterDerived, characterDerivedSchema } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { entryKey, itemKey, refKey } from "./keys.ts";

type Lists = {
  [K in keyof CharacterDerived as CharacterDerived[K] extends readonly unknown[]
    ? K
    : never]: CharacterDerived[K];
};

/**
 * The path segment naming one element of each list in the block, so an override follows
 * the skill, class or slot level it was typed over rather than its position. A list
 * added to the block fails to compile until it names one here.
 *
 * A container holds no overridable field, so its name stands in for a key nothing reads.
 *
 * An inventory entry carries an id only once it holds something, so a weapon is named by its item and which copy of
 * that item it is. Removing another item leaves the override on its weapon. Reordering
 * two copies of one item swaps theirs, and removing an earlier copy hands its override
 * to the next; only an id per entry fixes that.
 */
const ELEMENT_KEY: {
  [K in keyof Lists]: (element: Lists[K][number], definition: CharacterDefinition) => string;
} = {
  hitDice: (pool) => String(pool.die),
  skills: (skill) => refKey(skill.ref),
  customSkills: (skill) => skill.name,
  spellcasting: (caster) => entryKey(caster.class),
  spellSlots: (slot) => String(slot.level),
  containers: (container) => container.name,
  attacks: (attack, { inventory }) => {
    const earlier = inventory.slice(0, attack.entry + 1).map(itemKey);
    const item = earlier.pop() ?? "";
    return `${item}#${earlier.filter((key) => key === item).length}`;
  },
};

/**
 * The override key prefix for one element of a list in the derived block, the path
 * `applyOverrides` folds under. A caller appends the field's own path, such as `.modifier`.
 */
export function overrideKey<K extends keyof Lists>(
  list: K,
  element: Lists[K][number],
  definition: CharacterDefinition,
): string {
  const key = ELEMENT_KEY[list] as (element: unknown, definition: CharacterDefinition) => string;
  return `${list}.${key(element, definition)}`;
}

const isDerived = (node: object): node is { computed: unknown; manual: unknown } =>
  "computed" in node && "manual" in node;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A field whose value is an object, such as `speed`, also takes one key per member, such
 * as `speed.fly`. Each lays over the whole-field override where one is stored, else over
 * the computed object, so a recomputed member the user never typed over still moves.
 */
function visit(node: unknown, path: string, overrides: Record<string, unknown>): void {
  if (typeof node !== "object" || node === null) return;
  if (isDerived(node)) {
    if (Object.hasOwn(overrides, path)) node.manual = overrides[path];
    if (!isRecord(node.computed)) return;
    const prefix = `${path}.`;
    const members = Object.entries(overrides).filter(([key]) => key.startsWith(prefix));
    if (members.length === 0) return;
    const base = isRecord(node.manual) ? node.manual : node.computed;
    node.manual = {
      ...base,
      ...Object.fromEntries(members.map(([key, value]) => [key.slice(prefix.length), value])),
    };
    return;
  }
  for (const [key, child] of Object.entries(node)) visit(child, `${path}.${key}`, overrides);
}

/**
 * Folds each stored override into the `manual` of the field its key names. A key naming
 * no field, such as a skill the catalog no longer lists, is left unapplied rather than
 * deleted. A value its field's schema refuses is left unapplied too, so one bad override
 * cannot fail the whole block.
 */
export function applyOverrides(
  block: CharacterDerived,
  definition: CharacterDefinition,
): CharacterDerived {
  const { overrides } = definition;
  if (Object.keys(overrides).length === 0) return block;
  const folded = structuredClone(block);
  for (const [key, value] of Object.entries(folded)) {
    if (Array.isArray(value) && key in ELEMENT_KEY) {
      for (const element of value)
        visit(element, overrideKey(key as keyof Lists, element, definition), overrides);
    } else {
      visit(value, key, overrides);
    }
  }
  const parsed = characterDerivedSchema.safeParse(folded);
  if (parsed.success) return parsed.data;
  // `deriveCharacter` builds a block its schema accepts, so every issue sits under a
  // `manual` the fold wrote.
  for (const { path } of parsed.error.issues) {
    const field = path
      .slice(0, path.lastIndexOf("manual"))
      .reduce<Record<PropertyKey, unknown>>(
        (node, segment) => node[segment] as Record<PropertyKey, unknown>,
        folded as unknown as Record<PropertyKey, unknown>,
      );
    field.manual = null;
  }
  return characterDerivedSchema.parse(folded);
}
