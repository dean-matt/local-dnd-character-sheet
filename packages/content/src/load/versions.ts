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
const WHOLE_VALUE = /^\{\{(\w+)\}\}$/;

/**
 * Fills `{{name}}` throughout a template. A string that is nothing but one
 * placeholder becomes that variable's value whole, so a variable holding a list
 * — `resist` on the chromatic dragonborn — arrives as a list rather than as its
 * text. Interpolating one into surrounding prose would read `[object Object]`,
 * so it is refused instead. A placeholder with no variable is left for `expand`
 * to catch once the `_mod` has run.
 */
function fill(node: unknown, variables: Entry, context: string): unknown {
  if (typeof node === "string") {
    const whole = WHOLE_VALUE.exec(node);
    const named = whole?.[1];
    if (named !== undefined && named in variables) return structuredClone(variables[named]);
    return node.replace(PLACEHOLDER, (all, key: string) => {
      if (!(key in variables)) return all;
      const value = variables[key];
      if (typeof value !== "string") {
        throw new Error(`${context}: ${all} holds no text, and sits inside some`);
      }
      return value;
    });
  }
  if (Array.isArray(node)) return node.map((child) => fill(child, variables, context));
  if (!isRecord(node)) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, fill(value, variables, context)]),
  );
}

function variablesOf(implementation: Entry, context: string): Entry {
  const declared = implementation._variables;
  if (!isRecord(declared)) throw new Error(`${context}: an _implementation declares no _variables`);
  return declared;
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
  return implementations.map((implementation) => {
    if (!isRecord(implementation))
      throw new Error(`${context}: an _implementation is not an object`);
    const { _variables: _used, ...own } = implementation;
    const filled = fill(template, variablesOf(implementation, context), context) as Entry;
    return { ...filled, ...own };
  });
}

/** One complete entry: the base, the version's own fields, then its `_mod`. */
function expand(base: Entry, spec: Entry, context: string): Entry {
  const { _mod: mod, ...own } = spec;
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
