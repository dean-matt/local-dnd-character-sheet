import { type CharacterDerived, characterDerivedSchema } from "./characterDerived.ts";
import { entryKey, refKey } from "./keys.ts";

type Lists = {
  [K in keyof CharacterDerived as CharacterDerived[K] extends readonly unknown[]
    ? K
    : never]: CharacterDerived[K];
};

/**
 * The path segment naming one element of each list in the block, so an override follows
 * the skill, class or slot level it was typed over rather than its position. A list
 * added to the block fails to compile until it names one here.
 */
const ELEMENT_KEY: { [K in keyof Lists]: (element: Lists[K][number]) => string } = {
  hitDice: (pool) => String(pool.die),
  skills: (skill) => refKey(skill.ref),
  spellcasting: (caster) => entryKey(caster.class),
  spellSlots: (slot) => String(slot.level),
  attacks: (attack) => String(attack.entry),
};

const isDerived = (node: object): node is { manual: unknown } =>
  "computed" in node && "manual" in node;

function visit(node: unknown, path: string, overrides: Record<string, unknown>): void {
  if (typeof node !== "object" || node === null) return;
  if (isDerived(node)) {
    if (Object.hasOwn(overrides, path)) node.manual = overrides[path];
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
  overrides: Record<string, unknown>,
): CharacterDerived {
  if (Object.keys(overrides).length === 0) return block;
  const folded = structuredClone(block);
  for (const [key, value] of Object.entries(folded)) {
    const elementKey = ELEMENT_KEY[key as keyof Lists] as
      | ((element: unknown) => string)
      | undefined;
    if (Array.isArray(value) && elementKey) {
      for (const element of value) visit(element, `${key}.${elementKey(element)}`, overrides);
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
