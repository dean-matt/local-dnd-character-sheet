/**
 * Expands 5etools `_versions` into complete sibling entries.
 *
 * `_versions` is the second inheritance mechanism in the data and is unrelated
 * to `_copy`: a copy merges two entries into one, a version expands one entry
 * into several. The base entry survives its versions — upstream offers the
 * Dragonborn and each of its ten colours — so this adds rows rather than
 * replacing them.
 *
 * A version is either written out, carrying its own `name`, `source` and any
 * fields that differ, or written once as an `_abstract` template with
 * `{{placeholder}}` text and an `_implementations` list supplying the
 * substitutions. Both end as a clone of the base with the version's own fields
 * over the top and its `_mod` applied.
 *
 * Runs after `copy.ts`, never before: three race entries are both a copy and a
 * source of versions, and a `_mod` here removes an element the copy supplied.
 */
import { type Entry, isRecord } from "./json.ts";
import { applyMod } from "./mod.ts";

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** Every `{{name}}` the template asks for. */
function placeholdersIn(template: Entry): Set<string> {
  const asked = new Set<string>();
  for (const [, name] of JSON.stringify(template).matchAll(PLACEHOLDER)) asked.add(name as string);
  return asked;
}

/** Fills `{{name}}` throughout a template. Every name is known by the time this runs. */
function fill(node: unknown, variables: Record<string, string>): unknown {
  if (typeof node === "string") {
    return node.replace(PLACEHOLDER, (all, name: string) =>
      Object.hasOwn(variables, name) ? (variables[name] as string) : all,
    );
  }
  if (Array.isArray(node)) return node.map((child) => fill(child, variables));
  if (!isRecord(node)) return node;
  // Keys too, because `placeholdersIn` counts a placeholder wherever it reads
  // one, and a name it called used has to be a name this fills.
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      fill(key, variables) as string,
      fill(value, variables),
    ]),
  );
}

/**
 * The substitutions one implementation supplies, checked against what the
 * template asks for. A variable nothing references is upstream saying something
 * this does not act on — `Dragonborn (Chromatic)` in `FTD` declares a `resist`
 * list that no placeholder uses, and dropping it silently would file all five
 * colours under the base's "choose one of five". A variable that is not text
 * cannot be substituted into any of it.
 */
function variablesOf(
  implementation: Entry,
  asked: Set<string>,
  context: string,
): Record<string, string> {
  const declared = implementation._variables;
  if (!isRecord(declared)) throw new Error(`${context}: an _implementation declares no _variables`);
  // Null-prototype: a variable named `__proto__` would otherwise hit the
  // prototype setter and be dropped, and read back as never having been set.
  const variables: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [name, value] of Object.entries(declared)) {
    if (!asked.has(name)) {
      throw new Error(`${context}: _variables.${name} is set, and no {{${name}}} uses it`);
    }
    if (typeof value !== "string") {
      throw new Error(`${context}: _variables.${name} is not text, and a placeholder holds text`);
    }
    variables[name] = value;
  }
  return variables;
}

/**
 * The version specs a block describes: itself, or one per implementation of its
 * template. An implementation's own fields land on the filled template, so a
 * colour's damage resistance rides alongside the text that mentions it.
 */
function specsOf(block: Entry, context: string): Entry[] {
  const { _abstract: template, _implementations: implementations } = block;
  if (template === undefined && implementations === undefined) return [block];
  if (!isRecord(template) || !Array.isArray(implementations)) {
    throw new Error(`${context}: _abstract and _implementations come as a pair`);
  }
  const asked = placeholdersIn(template);
  return implementations.map((implementation) => {
    if (!isRecord(implementation)) {
      throw new Error(`${context}: an _implementation is not an object`);
    }
    const { _variables: _used, ...own } = implementation;
    const filled = fill(template, variablesOf(implementation, asked, context)) as Entry;
    return { ...filled, ...own };
  });
}

/** One complete entry: the base, the version's own fields, then its `_mod`. */
function expand(base: Entry, spec: Entry, context: string): Entry {
  // A version's own `_versions` is dropped with the base's: nothing revisits an
  // entry this emits, so leaving one would hand a loader an unresolved block.
  const { _mod: mod, _versions: _nested, ...own } = spec;
  const { _versions: _dropped, ...inherited } = base;
  const version: Entry = structuredClone({ ...inherited, ...own });
  if (mod !== undefined) {
    if (!isRecord(mod)) throw new Error(`${context}: _mod is not an object`);
    applyMod(version, mod, context);
  }
  const unfilled = PLACEHOLDER.exec(JSON.stringify(version));
  PLACEHOLDER.lastIndex = 0;
  if (unfilled) {
    throw new Error(`${context}: ${unfilled[0]} was never given a value`);
  }
  return version;
}

/** The entry a message is about, in `copy.ts`'s shape. Some subraces have no name. */
function describe(base: Entry): string {
  return `"${String(base.name ?? base.raceName ?? "unnamed")}" (${String(base.source)})`;
}

function versionsOf(base: Entry, context: string): Entry[] {
  const blocks = base._versions;
  if (!Array.isArray(blocks)) throw new Error(`${context}: _versions is not a list`);
  const named = `${context}: ${describe(base)}`;
  return blocks.flatMap((block) => {
    if (!isRecord(block)) throw new Error(`${named}: a _versions block is not an object`);
    return specsOf(block, named).map((spec) => expand(base, spec, named));
  });
}

/** Returns `source` with every `_versions` block expanded into sibling entries. */
export function resolveVersions(source: unknown, context: string): unknown {
  if (!isRecord(source)) return source;
  const carries = (value: unknown): value is unknown[] =>
    Array.isArray(value) && value.some((entry) => isRecord(entry) && entry._versions !== undefined);
  // Most files have none, and handing back the same object keeps them cheap.
  if (!Object.values(source).some(carries)) return source;
  const out: Entry = {};
  for (const [property, value] of Object.entries(source)) {
    if (!carries(value)) {
      out[property] = value;
      continue;
    }
    out[property] = value.flatMap((entry: unknown) => {
      if (!isRecord(entry)) return [entry];
      const { _versions: _dropped, ...base } = entry;
      return entry._versions === undefined
        ? [entry]
        : [base, ...versionsOf(entry, `${context} ${property}`)];
    });
  }
  return out;
}
