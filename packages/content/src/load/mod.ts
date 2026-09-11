/**
 * Applies a 5etools `_mod` block to an entry.
 *
 * All three inheritance mechanisms in the data carry one: `_copy` merges a parent
 * into a child and then mods the result, `_versions` mods a clone of the entry
 * per variant, and a `monsterTemplate` mods whatever creature names it. The modes
 * are the same in all three, so they are applied here and none of the mechanisms
 * owns them.
 *
 * Anything unrecognized throws. A mode this does not implement is a mode whose
 * effect nobody has checked, and half-applying it writes an entry that looks
 * complete.
 */
import { type Entry, isRecord } from "./json.ts";
import { addSenses, addSkills, capSize, modifySpells, multiplyXp, signed } from "./stat-block.ts";

/**
 * Keys whose values `replaceTxt` descends into: every prose-bearing key in the
 * vendored entry trees.
 *
 * Not a blocklist, because some strings it must skip are references rather than
 * structure — `subclassFeature`, `reprintedAs` and `data.overwrite` hold
 * `Name|Source|...` pointers, and rewriting prose must not rewrite a link.
 */
const TEXT_KEYS = new Set([
  "entry",
  "entries",
  "name",
  "items",
  "rows",
  "caption",
  "colLabels",
  "footnotes",
  "tableName",
  "headerEntries",
  "footerEntries",
]);

/** `_mod` accepts a single operation or a list of them, and `items` a single item or a list. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function rewriteText(node: unknown, edit: (text: string) => string): unknown {
  if (typeof node === "string") return edit(node);
  if (Array.isArray(node)) return node.map((child) => rewriteText(child, edit));
  if (!isRecord(node)) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      TEXT_KEYS.has(key) ? rewriteText(value, edit) : value,
    ]),
  );
}

/**
 * splice clamps, so an unchecked index past the end appends instead of landing
 * where the mod said, and `replaceArr` also leaves its target in place.
 * `insertArr` alone accepts `length`, since inserting there is an append.
 */
function checkIndex(index: number, list: unknown[], mode: string, context: string): number {
  const last = mode === "insertArr" ? list.length : list.length - 1;
  if (index < -list.length || index > last) {
    throw new Error(`${context}: ${mode} index ${index} is outside a list of ${list.length}`);
  }
  return index;
}

/** `replace` is either the `name` of the element to swap out or an explicit `{ index }`. */
function replaceIndex(list: unknown[], replace: unknown, context: string): number {
  if (isRecord(replace) && typeof replace.index === "number") {
    return checkIndex(replace.index, list, "replaceArr", context);
  }
  const index = list.findIndex((item) => isRecord(item) && item.name === replace);
  if (index === -1) {
    throw new Error(`${context}: replaceArr matched no element named "${String(replace)}"`);
  }
  return index;
}

/**
 * Renames elements by name, in place. Every use strips a qualifier the base
 * carries for all of its versions — the Aberrant Spirit's `Parry (Duelist Only)`
 * is `Parry` on the version that is the duelist.
 *
 * A name matching nothing is refused, for the reason `replaceArr` refuses it: a
 * rename that renames nothing reads as a working mod.
 */
function renameIn(list: unknown[], declared: unknown, context: string): unknown[] {
  const renamed = [...list];
  for (const one of asArray(declared)) {
    if (!isRecord(one) || typeof one.rename !== "string" || typeof one.with !== "string") {
      throw new Error(`${context}: renameArr needs a "rename" and a "with", both text`);
    }
    const at = renamed.findIndex((item) => isRecord(item) && item.name === one.rename);
    if (at === -1) {
      throw new Error(`${context}: renameArr matched no element named "${one.rename}"`);
    }
    renamed[at] = { ...(renamed[at] as Entry), name: one.with };
  }
  return renamed;
}

const ARRAY_MODES = new Set([
  "appendArr",
  "appendIfNotExistsArr",
  "prependArr",
  "insertArr",
  "replaceArr",
  "removeArr",
  "renameArr",
]);

/** Every mode but `removeArr` splices something in, and needs `items` to do it. */
const NEEDS_ITEMS = new Set([
  "appendArr",
  "appendIfNotExistsArr",
  "prependArr",
  "insertArr",
  "replaceArr",
]);

/**
 * Compares by value, because the lists this is asked about hold strings — a
 * language, a damage type — and two equal ones are the same entry. An element
 * that is an object compares by its serialization, which is exact rather than
 * clever: a differently ordered twin counts as new.
 */
function appendMissing(list: unknown[], items: unknown[]): unknown[] {
  const held = new Set(list.map((item) => JSON.stringify(item)));
  return [...list, ...items.filter((item) => !held.has(JSON.stringify(item)))];
}

/**
 * Writes `value` at a dotted path, so a mod can reach inside a nested field —
 * `apply._root.type` on a monster template. A path of one key is the common case
 * and the loop does nothing.
 */
function setPath(entry: Entry, path: string, value: unknown, context: string): void {
  const parts = path.split(".");
  const last = parts.pop();
  if (last === undefined || last === "") throw new Error(`${context}: setProp has no prop`);
  let target = entry;
  for (const part of parts) {
    const next = target[part];
    if (!isRecord(next))
      throw new Error(`${context}: setProp cannot reach ${path} through ${part}`);
    target = next;
  }
  target[last] = value;
}

/** What a `names` removal compares, against a wanted name and against a list element. */
const BY_NAME = {
  wanted: (value: unknown): string => String(value),
  held: (item: unknown): string => (isRecord(item) ? String(item.name) : ""),
};

/** What an `items` removal compares, for a list whose elements are the values themselves. */
const BY_VALUE = {
  wanted: (value: unknown): string => JSON.stringify(value),
  held: (item: unknown): string => JSON.stringify(item),
};

/**
 * A property the entry does not carry is nothing to remove from, and the end
 * state is what the mod asked for either way: the PHB Dragonborn subrace
 * removes "Draconic Ancestry", which upstream renders from the parent race
 * rather than storing on the subrace. A name absent from a list that *is* here
 * stays an error, so a typo is still caught.
 *
 * `names` matches an element by its `name` and `items` matches the element
 * itself, which is what a list of plain strings needs — the `Snow Maiden` (CoS)
 * drops "cold" from her parent's resistances. Upstream writes one or the other.
 *
 * `force` waives the check, for a removal written against many entries rather
 * than one: the Dracolich template drops "Amphibious", which only some of the
 * dragons it is applied to have. It is the one use in the data, and the reason a
 * typo has somewhere to hide, so it stays opt-in.
 */
function removeFrom(
  entry: Entry,
  property: string,
  target: unknown,
  list: unknown[],
  op: Entry,
  context: string,
): void {
  // asArray(undefined) is [undefined], which would read as a name of "undefined".
  const declared = op.names ?? op.items;
  const wanted = declared === undefined ? [] : asArray(declared);
  if (wanted.length === 0) throw new Error(`${context}: removeArr needs names or items`);
  if (target === undefined) return;

  const match = op.names !== undefined ? BY_NAME : BY_VALUE;
  const held = new Set(list.map(match.held));
  // Each one, not the total removed: two elements sharing a name would otherwise
  // cover for a third that matches nothing, which is the typo.
  const absent = wanted.filter((value) => !held.has(match.wanted(value)));
  if (absent.length > 0 && op.force !== true) {
    throw new Error(
      `${context}: removeArr names ${absent.map((value) => `"${String(value)}"`).join(", ")}, which ${property} does not hold`,
    );
  }
  const going = new Set(wanted.map(match.wanted));
  entry[property] = list.filter((item) => !going.has(match.held(item)));
}

/**
 * The list a splicing mode edits, after the two checks every one of them shares.
 * Appending to a property the parent lacks is normal; present and not a list
 * means the mod and the data disagree, where `[]` would drop the value.
 */
function listToSplice(target: unknown, property: string, op: Entry, context: string): unknown[] {
  const mode = String(op.mode);
  if (ARRAY_MODES.has(mode) && target !== undefined && !Array.isArray(target)) {
    throw new Error(`${context}: _mod.${property} expects a list, found ${typeof target}`);
  }
  // Splicing a missing `items` inserts a literal `undefined`, stored as NULL.
  // Only for known modes, so an unrecognized one reports as unrecognized.
  if (NEEDS_ITEMS.has(mode) && op.items === undefined) {
    throw new Error(`${context}: ${mode} needs items`);
  }
  return Array.isArray(target) ? [...target] : [];
}

/** Rewrites the prose under one property, leaving the references beside it alone. */
function rewrite(
  entry: Entry,
  property: string,
  target: unknown,
  op: Entry,
  context: string,
): void {
  if (typeof op.replace !== "string" || typeof op.with !== "string") {
    throw new Error(`${context}: replaceTxt needs a string "replace" and "with"`);
  }
  // Rewriting an absent property assigns `undefined`, stored as NULL.
  if (target === undefined) {
    throw new Error(`${context}: replaceTxt has no ${property} to rewrite`);
  }
  const flags = typeof op.flags === "string" ? op.flags : "";
  const pattern = new RegExp(op.replace, `g${flags}`);
  const replacement = op.with;
  entry[property] = rewriteText(target, (text) => text.replace(pattern, replacement));
}

/**
 * Shifts every `{@hit}` or `{@dc}` under one property, which is where a creature's
 * arithmetic actually sits: a −2 to attack rolls is not a field on the stat block
 * but a number inside each attack's prose.
 *
 * An operand that is not a plain integer is refused rather than left standing. The
 * only other thing upstream writes there is a `_versions` placeholder such as
 * `<$to_hit__str$>`, and a shifted block that silently kept an unshifted number
 * reads as a working mod.
 */
function shiftTag(entry: Entry, property: string, tag: string, op: Entry, context: string): void {
  const mode = String(op.mode);
  if (typeof op.scalar !== "number") throw new Error(`${context}: ${mode} needs a scalar`);
  const scalar = op.scalar;
  const pattern = new RegExp(`\\{@${tag} ([^}]*)\\}`, "g");

  entry[property] = rewriteText(entry[property], (text) =>
    text.replace(pattern, (_whole, operand: string) => {
      if (!/^[+-]?\d+$/.test(operand)) {
        throw new Error(`${context}: ${mode} cannot shift {@${tag} ${operand}}`);
      }
      const shifted = Number(operand) + scalar;
      // `{@hit +7}` and `{@hit 7}` both occur and render alike, so the operand
      // keeps the form upstream wrote it in.
      return `{@${tag} ${operand.startsWith("+") ? signed(shifted) : String(shifted)}}`;
    }),
  );
}

/** The keys inside a property one of the `Prop` modes edits — `*` is every key it holds. */
function propsToEdit(target: Entry, op: Entry, context: string): string[] {
  const prop = op.prop;
  if (typeof prop !== "string") throw new Error(`${context}: ${String(op.mode)} needs a prop`);
  return prop === "*" ? Object.keys(target) : [prop];
}

/** What a value the mode cannot compute over raises. */
type Refuse = () => never;

function wrapValue(value: unknown, op: Entry, refuse: Refuse): string {
  if (typeof value !== "string") refuse();
  const prefix = typeof op.prefix === "string" ? op.prefix : "";
  const suffix = typeof op.suffix === "string" ? op.suffix : "";
  return `${prefix}${String(value)}${suffix}`;
}

function scaleValue(value: unknown, op: Entry, scalar: number, refuse: Refuse): number {
  if (typeof value !== "number") refuse();
  const scaled = (value as number) * scalar;
  return op.floor === true ? Math.floor(scaled) : scaled;
}

function shiftValue(value: unknown, scalar: number, refuse: Refuse): number | string {
  if (typeof value === "number") return value + scalar;
  // A bonus is written signed, and stays signed once shifted.
  if (typeof value === "string" && /^[+-]?\d+$/.test(value)) return signed(Number(value) + scalar);
  return refuse();
}

/**
 * One value, edited by whichever of the three `Prop` modes named it.
 *
 * A value the mode cannot compute over is refused: `skill` carries an `other` key
 * whose value is a list of conditional bonuses, and a `*` that skipped it would
 * scale the printed skills and leave one of them alone.
 */
function editValue(value: unknown, op: Entry, path: string, context: string): unknown {
  const mode = String(op.mode);
  const refuse: Refuse = () => {
    throw new Error(`${context}: ${mode} cannot edit ${path}`);
  };

  if (mode === "prefixSuffixStringProp") return wrapValue(value, op, refuse);
  if (typeof op.scalar !== "number") throw new Error(`${context}: ${mode} needs a scalar`);
  if (mode === "scalarMultProp") return scaleValue(value, op, op.scalar, refuse);
  return shiftValue(value, op.scalar, refuse);
}

/**
 * Adds, multiplies or wraps values inside a property's object — the −2 on every
 * saving throw a reduced-threat creature is proficient in, and the halved average
 * hit points beside the formula that says so.
 */
function editProps(entry: Entry, property: string, op: Entry, context: string): void {
  const target = entry[property];
  if (!isRecord(target)) {
    throw new Error(
      `${context}: ${String(op.mode)} needs ${property} to be an object, found ${typeof target}`,
    );
  }
  const edited: Entry = { ...target };
  for (const prop of propsToEdit(target, op, context)) {
    edited[prop] = editValue(edited[prop], op, `${property}.${prop}`, context);
  }
  entry[property] = edited;
}

/**
 * The modes that scale what a property already holds, rather than splicing or
 * rewriting it.
 *
 * A property the creature lacks is nothing for one of these to scale, and every
 * template carrying them names more properties than any one creature has: the
 * Reduced Threat template shifts `save`, `skill`, `legendary` and `variant`, and
 * the reduced basilisk has none of the four. `replaceTxt` refuses the same case
 * because it assigns unconditionally, where these return.
 */
const SCALAR_MODES = new Set([
  "scalarAddHit",
  "scalarAddDc",
  "scalarAddProp",
  "scalarMultProp",
  "prefixSuffixStringProp",
]);

function applyOperation(entry: Entry, property: string, op: Entry, context: string): void {
  const target = entry[property];
  if (target === undefined && SCALAR_MODES.has(String(op.mode))) return;
  const list = listToSplice(target, property, op, context);
  const items = asArray(op.items);
  switch (op.mode) {
    case "appendArr":
      entry[property] = [...list, ...items];
      return;
    case "appendIfNotExistsArr":
      entry[property] = appendMissing(list, items);
      return;
    case "prependArr":
      entry[property] = [...items, ...list];
      return;
    case "insertArr":
      if (typeof op.index !== "number") throw new Error(`${context}: insertArr needs an index`);
      list.splice(checkIndex(op.index, list, "insertArr", context), 0, ...items);
      entry[property] = list;
      return;
    case "replaceArr":
      list.splice(replaceIndex(list, op.replace, context), 1, ...items);
      entry[property] = list;
      return;
    case "removeArr":
      removeFrom(entry, property, target, list, op, context);
      return;
    case "renameArr":
      entry[property] = renameIn(list, op.renames, context);
      return;
    // The property this sits under is the one it writes, unless it names another.
    // Only a whole-entry op has to name one, having no property of its own.
    case "setProp":
      setPath(entry, typeof op.prop === "string" ? op.prop : property, op.value, context);
      return;
    case "replaceTxt":
      rewrite(entry, property, target, op, context);
      return;
    case "scalarAddHit":
      shiftTag(entry, property, "hit", op, context);
      return;
    case "scalarAddDc":
      shiftTag(entry, property, "dc", op, context);
      return;
    case "scalarAddProp":
    case "scalarMultProp":
    case "prefixSuffixStringProp":
      editProps(entry, property, op, context);
      return;
    default:
      throw new Error(`${context}: unsupported _mod mode "${String(op.mode)}"`);
  }
}

/**
 * An operation written as a bare word rather than an object. `"remove"` is the
 * only one upstream writes, and it deletes the property outright —
 * `"action": "remove"` on an NPC that fights with nothing.
 */
function applyShorthand(entry: Entry, property: string, shorthand: string, context: string): void {
  if (shorthand !== "remove") {
    throw new Error(`${context}: _mod.${property} is "${shorthand}", which is not an operation`);
  }
  delete entry[property];
}

/**
 * An operation that takes the entry rather than one of its properties, which is
 * what the `_` property means. Each of these reads something the entry holds
 * elsewhere: a spell list nested in `spellcasting`, a skill bonus derived from an
 * ability score, or a field named by the op instead of by the property above it.
 */
function applyToEntry(entry: Entry, op: Entry, context: string): void {
  switch (op.mode) {
    case "setProp":
      if (typeof op.prop !== "string") {
        throw new Error(`${context}: a whole-entry setProp has to name its prop`);
      }
      setPath(entry, op.prop, op.value, context);
      return;
    case "addSkills":
      addSkills(entry, op, context);
      return;
    case "addSenses":
      addSenses(entry, op, context);
      return;
    case "maxSize":
      capSize(entry, op, context);
      return;
    case "scalarMultXp":
      multiplyXp(entry, op, context);
      return;
    case "addSpells":
    case "replaceSpells":
    case "removeSpells":
      modifySpells(entry, op, op.mode, context);
      return;
    default:
      throw new Error(`${context}: unsupported whole-entry _mod mode "${String(op.mode)}"`);
  }
}

/** `*` is every property, `_` the entry itself. Neither is a property an entry has. */
const isWildcard = (property: string): boolean => property === "*" || property === "_";

/** One operation, whichever of the three kinds of property it was written under. */
function applyOne(entry: Entry, property: string, op: unknown, context: string): void {
  if (typeof op === "string") {
    // Ahead of the shorthand, which would delete the key `*` and report nothing,
    // an entry having no such property. A wildcard names no property to remove.
    if (isWildcard(property)) {
      throw new Error(`${context}: _mod.${property} cannot be "${op}"`);
    }
    applyShorthand(entry, property, op, context);
  } else if (!isRecord(op)) {
    throw new Error(`${context}: _mod.${property} is not an operation`);
  } else if (property === "_") {
    applyToEntry(entry, op, context);
  } else if (property === "*") {
    applyToEvery(entry, op, context);
  } else {
    applyOperation(entry, property, op, context);
  }
}

/**
 * The stat block sections a `*` operation sweeps: the ones holding rules text,
 * and nothing else.
 *
 * `*` reads as "every property" and cannot be taken that way. All 802 uses rename
 * a creature — `{replace: "the vampire", with: "Ctenmiir"}` — and a rename let
 * loose on the whole entry rewrites the parts that are not prose. Against the
 * real bestiary that corrupts an identity key, a file path, a tag and a
 * reference: `Ctenmiir the Vampire` becomes `Ctenmiir Ctenmiir`, `soundClip.path`
 * points at audio that was never recorded, `ac.condition` asks for
 * `{@spell aarakocra armor}`, and `reprintedAs`, `altArt`, `legendaryGroup` and
 * `type` stop naming anything.
 *
 * It costs one rewrite upstream would have made: the Werejaguar's speed reads
 * "(40 ft. in tiger form)" where its prose says jaguar. Stale text in a machine
 * field is the cheaper of the two, and the invariant this file already states —
 * rewriting prose must not rewrite a link — is the one that decides it.
 *
 * The ceiling is that this is a hand-kept list, so a section upstream adds is
 * skipped in silence, which is the failure it fixes running the other way. The
 * header and note keys are here for that reason rather than because a `*` reaches
 * them: `reactionNote` reads "Charmayne can take up to three reactions per round",
 * a creature's name in free text, and leaving a sibling out is how the gap starts.
 * The way out is a fixture asserting the set against a rebuilt corpus, which needs
 * the vendored data CI does not fetch.
 */
const PROSE_SECTIONS = [
  "action",
  "actionNote",
  "bonus",
  "entries",
  "legendary",
  "legendaryHeader",
  "mythic",
  "mythicHeader",
  "pbNote",
  "reaction",
  "reactionHeader",
  "reactionNote",
  "sizeNote",
  "spellcasting",
  "trait",
  "variant",
];

function applyToEvery(entry: Entry, op: Entry, context: string): void {
  for (const key of PROSE_SECTIONS) {
    if (entry[key] !== undefined) applyOperation(entry, key, op, context);
  }
}

/**
 * A named property's operations run before either wildcard's, whatever order the
 * block was written in.
 *
 * `Flying Dagger` (MM) is why: it copies `Flying Sword` with a `*` rewriting
 * "sword" to "dagger" and an `action` replacing the element named "Longsword",
 * and upstream writes the `*` first. Rewriting first renames that element to
 * "Longdagger", so the replacement matches nothing and the build fails on data
 * upstream renders correctly. A wildcard is a sweep over whatever the named
 * operations have left, which is the only order that reads both as written.
 */
export function applyMod(entry: Entry, mod: Entry, context: string): void {
  const operations = Object.entries(mod);
  const ordered = [
    ...operations.filter(([property]) => !isWildcard(property)),
    ...operations.filter(([property]) => isWildcard(property)),
  ];

  for (const [property, declared] of ordered) {
    for (const op of asArray(declared)) applyOne(entry, property, op, context);
  }
}
