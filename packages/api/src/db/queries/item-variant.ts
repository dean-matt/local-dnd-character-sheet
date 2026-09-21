/**
 * Expands a magic variant against a base item at query time — the substitute for storing
 * the roughly 6,000 items upstream builds from a template; see docs/items.md. `requires`
 * and `excludes` gate which base items a variant reaches, and `inherits` states the
 * fields the resulting item carries over the base item's own.
 */
import { getItem, type ItemRow } from "./content.ts";

type Entry = Record<string, unknown>;

function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Upstream's own `requires`/`excludes` match: every key in `requirements` must find an
 * equal or array-membership value on `candidate`, recursing where a clause nests an
 * object. `method` is `every` for one `requires` alternative — every key must hold — and
 * `some` for `excludes`, where any one key holding is enough to disqualify a base item.
 */
function isMatch(candidate: Entry, requirements: Entry, method: "every" | "some"): boolean {
  return Object.entries(requirements)[method](([key, wanted]) => {
    const held = candidate[key];
    if (Array.isArray(wanted)) {
      return Array.isArray(held) ? held.some((v) => wanted.includes(v)) : wanted.includes(held);
    }
    if (isRecord(wanted)) return isRecord(held) && isMatch(held, wanted, method);
    return Array.isArray(held) ? held.some((v) => v === wanted) : held === wanted;
  });
}

/** Whether `baseFields` is one this variant's `requires`/`excludes` allows expanding. */
export function baseItemMatchesVariant(baseFields: Entry, variantFields: Entry): boolean {
  const requires = variantFields.requires;
  if (!Array.isArray(requires) || requires.length === 0) {
    throw new Error("a magicvariant's requires must be a non-empty array");
  }
  const required = requires.some((req) => isRecord(req) && isMatch(baseFields, req, "every"));
  if (!required) return false;
  const excludes = variantFields.excludes;
  return !(isRecord(excludes) && isMatch(baseFields, excludes, "some"));
}

/**
 * Fields a base item's own identity carries that a magic variant restates rather than
 * inherits — its provenance (`srd`, `page`, `reprintedAs`...) and its mundane `value`,
 * which upstream never lets a magic item keep unpriced.
 */
const BASE_ONLY_FIELDS = [
  "srd",
  "srd52",
  "basicRules",
  "basicRules2024",
  "page",
  "reprintedAs",
  "referenceSources",
  "hasFluff",
  "hasFluffImages",
  "fluff",
  "value",
];

/**
 * `nameRemove` runs before `namePrefix`/`nameSuffix`, whatever order `inherits` was
 * written in — otherwise a suffix can attach to text the removal was meant to drop.
 */
function sortNameOpsFirst(entries: [string, unknown][]): [string, unknown][] {
  return [...entries].sort(
    ([a], [b]) => Number(b.includes("Remove")) - Number(a.includes("Remove")),
  );
}

/**
 * The arithmetic upstream evaluates for `valueExpression`/`weightExpression` —
 * `[[baseItem.value]] + 50000` and its like. Left-to-right with no precedence: every
 * expression upstream writes today is one operator between two operands.
 */
function evaluateExpression(expression: string, baseFields: Entry, mergedSoFar: Entry): number {
  const substituted = expression.replace(
    /\[\[(baseItem|item)\.([a-zA-Z0-9_.]+)]]/g,
    (_all, scope: string, path: string) => {
      const source = scope === "baseItem" ? baseFields : mergedSoFar;
      const value = path
        .split(".")
        .reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), source);
      if (typeof value !== "number") {
        throw new Error(`${expression}: ${scope}.${path} is not a number`);
      }
      return String(value);
    },
  );
  const tokens = substituted.match(/-?\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.length === 0)
    throw new Error(`${expression}: not an arithmetic expression`);
  let result = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const operand = Number(tokens[i + 1]);
    switch (tokens[i]) {
      case "+":
        result += operand;
        break;
      case "-":
        result -= operand;
        break;
      case "*":
        result *= operand;
        break;
      case "/":
        result /= operand;
        break;
      default:
        throw new Error(`${expression}: unrecognized operator "${tokens[i]}"`);
    }
  }
  return result;
}

/**
 * The base item's fields with the variant's `inherits` applied over them — name, source,
 * rarity and every other field `inherits` states; a field it says nothing about passes
 * through from the base item unchanged.
 */
export function expandItemFields(baseFields: Entry, inherits: Entry): Entry {
  const merged: Entry = { ...baseFields };
  for (const field of BASE_ONLY_FIELDS) delete merged[field];

  let name = String(baseFields.name);
  for (const [key, val] of sortNameOpsFirst(Object.entries(inherits))) {
    switch (key) {
      case "namePrefix":
        name = `${String(val)}${name}`;
        break;
      case "nameSuffix":
        name = `${name}${String(val)}`;
        break;
      case "nameRemove":
        name = name.split(String(val)).join("");
        break;
      case "entries": {
        const variantEntries = Array.isArray(val) ? val : [val];
        const baseEntries = Array.isArray(merged.entries) ? merged.entries : [];
        merged.entries = [...variantEntries, ...baseEntries];
        break;
      }
      case "valueExpression":
        merged.value = evaluateExpression(String(val), baseFields, merged);
        break;
      case "weightExpression":
        merged.weight = evaluateExpression(String(val), baseFields, merged);
        break;
      default:
        merged[key] = val;
    }
  }
  merged.name = name;
  return merged;
}

/** `true` and a condition such as `"by a spellcaster"` both require it; `optional` does not. */
function requiresAttunement(fields: Entry): 0 | 1 {
  const required = fields.reqAttune;
  return required === undefined || required === false || required === "optional" ? 0 : 1;
}

/**
 * The specific item a base item and a magic variant expand into.
 *
 * `undefined` where either `(name, source)` names no row; `null` where the variant's
 * `requires`/`excludes` refuses this base item — a variant is not expanded into an item
 * the rules do not allow.
 */
export function getExpandedItem(
  dataDir: string,
  base: { name: string; source: string },
  variant: { name: string; source: string },
): ItemRow | undefined | null {
  const baseRow = getItem(dataDir, base.name, base.source);
  const variantRow = getItem(dataDir, variant.name, variant.source);
  if (!baseRow || !variantRow) return undefined;
  if (baseRow.kind !== "baseitem") {
    throw new Error(`${base.name}|${base.source} is not a baseitem`);
  }
  if (variantRow.kind !== "magicvariant") {
    throw new Error(`${variant.name}|${variant.source} is not a magicvariant`);
  }

  const variantFields: Entry = JSON.parse(variantRow.json);
  const baseFields: Entry = JSON.parse(baseRow.json);
  if (!baseItemMatchesVariant(baseFields, variantFields)) return null;

  const inherits = variantFields.inherits;
  if (!isRecord(inherits))
    throw new Error(`${variant.name}|${variant.source}: inherits is missing`);

  const merged = expandItemFields(baseFields, inherits);
  return {
    name: String(merged.name),
    source: String(merged.source),
    edition: baseRow.edition,
    kind: "item",
    type: typeof merged.type === "string" ? merged.type : null,
    rarity: typeof merged.rarity === "string" ? merged.rarity : null,
    requires_attunement: requiresAttunement(merged),
    json: JSON.stringify(merged),
  };
}
