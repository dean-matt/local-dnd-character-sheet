/**
 * Marks the class and subclass features that offer a choice of other features, such as
 * `Totem Spirit` (PHB) offering `Bear`, `Eagle`, `Elk`, `Tiger` and `Wolf`: the offering
 * row takes `choose`, the count it lets a character pick, and each option row takes
 * `offered_by_name` and `offered_by_source`, so a reader drops the options a character
 * did not take.
 *
 * Upstream writes the choice as an `options` block of `refClassFeature` or
 * `refSubclassFeature` entries carrying a `count`. A block with no `count` lists features
 * granted together — `Blade Flourish` (XGE) grants all three flourishes — and marks
 * nothing. A block of `refOptionalfeature` entries is an optional-feature pick, which
 * `class-optional-features.ts` covers.
 */
import type { Row } from "./index.ts";
import { type Entry, isRecord } from "./json.ts";

const REF_FIELDS = { refClassFeature: "classFeature", refSubclassFeature: "subclassFeature" };

type Option = { name: string; source: string; owner: string };

/**
 * A feature reference's name, source and owner. Blank parts take upstream's defaults: a
 * class or subclass source of `PHB`, and a feature source of its subclass's, or its
 * class's where it has no subclass.
 */
function option(ref: string, subclass: boolean): Option {
  const part = (index: number, fallback = "PHB") => ref.split("|")[index] || fallback;
  if (!subclass) {
    const classSource = part(2);
    return {
      name: part(0, ""),
      source: part(4, classSource),
      owner: [part(1, ""), classSource, "", "", part(3, "")].join("|"),
    };
  }
  const subclassSource = part(4);
  return {
    name: part(0, ""),
    source: part(6, subclassSource),
    owner: [part(1, ""), part(2), part(3, ""), subclassSource, part(5, "")].join("|"),
  };
}

const ownerOf = (row: Row) =>
  [
    row.class_name,
    row.class_source,
    row.subclass_short_name ?? "",
    row.subclass_source ?? "",
    row.level,
  ].join("|");

const rowKey = (owner: string, name: unknown, source: unknown) =>
  `${owner}|${String(name)}|${String(source)}`;

/** Every `options` block in a feature's entries that names a choice of features. */
function choiceBlocks(node: unknown): Entry[] {
  if (Array.isArray(node)) return node.flatMap(choiceBlocks);
  if (!isRecord(node)) return [];
  const nested = Object.values(node).flatMap(choiceBlocks);
  const entries = Array.isArray(node.entries) ? node.entries : [];
  const isChoice =
    node.type === "options" &&
    node.count !== undefined &&
    entries.length > 0 &&
    entries.every((entry) => isRecord(entry) && String(entry.type) in REF_FIELDS);
  return isChoice ? [node, ...nested] : nested;
}

/** The row an option names, refused unless it shares its offering's owner and level. */
function optionRow(offering: Row, entry: Entry, byKey: Map<string, Row>, context: string): Row {
  const field = REF_FIELDS[entry.type as keyof typeof REF_FIELDS];
  const ref = String(entry[field]);
  const { name, source, owner } = option(ref, field === "subclassFeature");
  const row = owner === ownerOf(offering) ? byKey.get(rowKey(owner, name, source)) : undefined;
  if (!row) throw new Error(`${context}: option ${ref} names no feature beside it`);
  if (row.offered_by_name !== undefined) {
    throw new Error(`${context}: option ${ref} is offered twice`);
  }
  return row;
}

/**
 * Refuses an option that names no feature of its offering's own class, subclass and
 * level, since a reader filters the options out of exactly that list; and a count other
 * than 1, which every choice at the pinned tag picks, so a new count surfaces here rather
 * than being offered as one.
 */
export function markFeatureChoices(features: Row[], claims: Map<Row, string>): void {
  const byKey = new Map(features.map((row) => [rowKey(ownerOf(row), row.name, row.source), row]));
  for (const row of features) {
    const context = `${claims.get(row)}: ${String(row.name)}`;
    for (const block of choiceBlocks(JSON.parse(String(row.json)))) {
      if (block.count !== 1) {
        throw new Error(`${context}: an options block picks ${String(block.count)}, not 1`);
      }
      row.choose = block.count;
      for (const entry of block.entries as Entry[]) {
        const target = optionRow(row, entry, byKey, context);
        target.offered_by_name = row.name;
        target.offered_by_source = row.source;
      }
    }
  }
}
