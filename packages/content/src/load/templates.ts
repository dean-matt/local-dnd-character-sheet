/**
 * Applies the `monsterTemplate` entries a `_copy._templates` block names.
 *
 * This is the third inheritance mechanism in the data, and the only one whose
 * other side is not a creature: `_copy` names a parent monster and `_versions`
 * names nothing at all, where a template sits in its own property of
 * `bestiary/template.json` and is written to be applied to many creatures. 187
 * entries across 28 bestiary files name one.
 *
 * A template is `{name, source, apply}`. `apply._root` writes fields onto the
 * creature — mostly `type`, `size` and `speed`, the things a race decides — and
 * `apply._mod` is the same operation vocabulary the other two mechanisms use.
 * `crMin` and `prerequisite` say which creatures it may be applied to at all.
 */
import { type Entry, isRecord } from "./json.ts";
import { applyMod } from "./mod.ts";
import { challengeRating } from "./stat-block.ts";

/** The property holding the templates, which is also the pool a reference resolves against. */
export const TEMPLATE_PROPERTY = "monsterTemplate";

const fold = (value: unknown): unknown => (typeof value === "string" ? value.toLowerCase() : value);

/**
 * The one template a reference names.
 *
 * A name matches before an alias does, because two templates reach the same
 * reference: `Mountain Dwarf` aliases "Shield Dwarf" and there is also a template
 * of that name, which copies it. Matching the alias first would apply the one
 * upstream wrote the alias to stand in for.
 */
function findTemplate(pool: Entry[], reference: Entry, context: string): Entry {
  const named = pool.filter(
    (template) =>
      fold(template.name) === fold(reference.name) &&
      fold(template.source) === fold(reference.source),
  );
  const aliased = pool.filter(
    (template) =>
      Array.isArray(template.alias) &&
      template.alias.some((alias) => fold(alias) === fold(reference.name)) &&
      fold(template.source) === fold(reference.source),
  );
  const matches = named.length > 0 ? named : aliased;
  const only = matches[0];
  if (matches.length === 1 && only) return only;
  const trouble =
    matches.length === 0
      ? `which no ${TEMPLATE_PROPERTY} the loader declared holds`
      : `which ${matches.length} templates match`;
  throw new Error(
    `${context}: applies the template "${String(reference.name)}" (${String(reference.source)}), ${trouble}`,
  );
}

/** `size` is a list of the sizes a creature can be, and every one has to clear the ceiling. */
function checkSize(entry: Entry, want: Entry, context: string): void {
  const order = ["T", "S", "M", "L", "H", "G"];
  const ceiling = order.indexOf(String(want.max));
  if (ceiling === -1) {
    throw new Error(`${context}: it wants a size of ${String(want.max)}, which is not a size`);
  }
  const sizes = Array.isArray(entry.size) ? entry.size : [];
  const over = sizes.filter((size) => order.indexOf(String(size)) > ceiling);
  if (over.length > 0) {
    throw new Error(
      `${context}: it is size ${over.map(String).join(", ")}, over ${String(want.max)}`,
    );
  }
}

/** `type` is a bare word, or an object carrying it beside the tags that qualify it. */
function checkType(entry: Entry, want: Entry, context: string): void {
  const held = isRecord(entry.type) ? entry.type.type : entry.type;
  const allowed = Array.isArray(want.oneOf) ? want.oneOf : [];
  if (!allowed.some((one) => fold(one) === fold(held))) {
    throw new Error(
      `${context}: it is a ${String(held)}, and the template takes ${allowed.map(String).join(" or ")}`,
    );
  }
}

/** An ability score ceiling — the Awakened template applies only below an intelligence of 3. */
function checkScore(entry: Entry, ability: string, want: Entry, context: string): void {
  const score = entry[ability];
  if (typeof score !== "number") throw new Error(`${context}: its ${ability} is not a score`);
  if (score > Number(want.max)) {
    throw new Error(
      `${context}: its ${ability} is ${score}, over the template's ${String(want.max)}`,
    );
  }
}

/**
 * Refuses a template applied to a creature it does not fit, rather than applying
 * it anyway. Every pairing in the data clears both conditions, so this raises
 * only where upstream moves one side of a pairing and not the other.
 *
 * Read before `apply._root`, which is what makes an intelligence prerequisite
 * checkable at all — the Awakened template wants an intelligence under 3 and then
 * writes 10 over it.
 */
function checkRequirements(entry: Entry, template: Entry, context: string): void {
  const named = `${context}: the template "${String(template.name)}" (${String(template.source)}) does not fit ${String(entry.name)}`;

  if (template.crMin !== undefined) {
    const rating = challengeRating(entry, context);
    if (rating < Number(template.crMin)) {
      throw new Error(
        `${named}: its rating is ${rating}, under the template's ${String(template.crMin)}`,
      );
    }
  }
  if (template.prerequisite === undefined) return;
  if (!isRecord(template.prerequisite)) {
    throw new Error(`${named}: its prerequisite is not an object`);
  }
  for (const [key, want] of Object.entries(template.prerequisite)) {
    if (!isRecord(want)) throw new Error(`${named}: the ${key} prerequisite is not an object`);
    if (key === "size") checkSize(entry, want, named);
    else if (key === "type") checkType(entry, want, named);
    else if (["str", "dex", "con", "int", "wis", "cha"].includes(key)) {
      checkScore(entry, key, want, named);
    } else throw new Error(`${named}: it has a prerequisite of ${key}, which nothing checks`);
  }
}

/** The `apply` block, refused rather than skipped when a template carries none. */
function applyBlock(template: Entry, context: string): Entry {
  if (!isRecord(template.apply)) {
    throw new Error(
      `${context}: the template "${String(template.name)}" (${String(template.source)}) has nothing to apply`,
    );
  }
  return template.apply;
}

function writeRoot(merged: Entry, own: Entry, template: Entry, context: string): void {
  const root = applyBlock(template, context)._root;
  if (root === undefined) return;
  if (!isRecord(root)) throw new Error(`${context}: a template _root is not an object`);
  for (const [key, value] of Object.entries(root)) if (!(key in own)) merged[key] = value;
}

function runMod(merged: Entry, template: Entry, context: string): void {
  const mod = applyBlock(template, context)._mod;
  if (mod === undefined) return;
  if (!isRecord(mod)) throw new Error(`${context}: a template _mod is not an object`);
  applyMod(merged, mod, context);
}

/**
 * Applies every template a block names, in the order it names them.
 *
 * `own` is the child's own fields, which `_root` writes under rather than over: a
 * template states what a race does to a base creature, and an entry that spells
 * out the same field has already said what it wants. Twelve entries rely on it,
 * and `Umbraxakar` (WDMM) is the clearest — the Legendary Shadow Dragon template
 * points at the generic legendary group, where the entry names the bronze one.
 *
 * The mods run after, against the merged creature, and before the entry's own
 * `_mod`. `Oracs the Enduring` (EGW) is why that order and no other reads: it
 * copies an ancient black dragon under the Dracolich template, whose `*` rewrites
 * "dragon" to "dracolich", and then rewrites "the dracolich" to "Oracs".
 */
export function applyTemplates(
  merged: Entry,
  own: Entry,
  declared: unknown[],
  pool: Entry[],
  resolve: (template: Entry) => Entry,
  context: string,
): void {
  const templates = declared.map((reference) => {
    if (!isRecord(reference)) throw new Error(`${context}: a _templates entry is not an object`);
    return resolve(findTemplate(pool, reference, context));
  });

  for (const template of templates) checkRequirements(merged, template, context);
  for (const template of templates) writeRoot(merged, own, template, context);
  for (const template of templates) runMod(merged, template, context);
}
