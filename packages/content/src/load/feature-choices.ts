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
 * nothing, except where `UNCOUNTED_CHOICES` names its feature. A block of
 * `refOptionalfeature` entries is an optional-feature pick, which
 * `class-optional-features.ts` covers.
 */
import type { Row } from "./index.ts";
import { type Entry, isRecord } from "./json.ts";

const REF_FIELDS = { refClassFeature: "classFeature", refSubclassFeature: "subclassFeature" };

/**
 * The choices upstream writes in prose alone, as an options block with no `count`, keyed
 * by subclass short name and source, then feature name and source. A feature with
 * `follows` asks nothing: it takes the option whose name matches the one chosen for the
 * feature it names, so a Storm Herald chooses an environment once, at Storm Aura.
 */
const UNCOUNTED_CHOICES: Record<string, { follows?: { name: string; source: string } }> = {
  "Storm Herald|XGE|Storm Aura|XGE": {},
  "Storm Herald|XGE|Storm Soul|XGE": { follows: { name: "Storm Aura", source: "XGE" } },
  "Storm Herald|XGE|Raging Storm|XGE": { follows: { name: "Storm Aura", source: "XGE" } },
};

const uncountedKey = (row: Row) =>
  [row.subclass_short_name ?? "", row.subclass_source ?? "", row.name, row.source].join("|");

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

/**
 * Every `options` block in a feature's entries that names a choice of features: a block
 * with a `count`, or with none where `uncounted` holds.
 */
function choiceBlocks(node: unknown, uncounted: boolean): Entry[] {
  if (Array.isArray(node)) return node.flatMap((each) => choiceBlocks(each, uncounted));
  if (!isRecord(node)) return [];
  const nested = Object.values(node).flatMap((each) => choiceBlocks(each, uncounted));
  const entries = Array.isArray(node.entries) ? node.entries : [];
  const isChoice =
    node.type === "options" &&
    (node.count === undefined) === uncounted &&
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
 * than being offered as one. Refuses an `UNCOUNTED_CHOICES` feature whose block now
 * carries a count, or none at all, so a fix upstream surfaces too.
 */
export function markFeatureChoices(features: Row[], claims: Map<Row, string>): void {
  const byKey = new Map(features.map((row) => [rowKey(ownerOf(row), row.name, row.source), row]));
  const followers: Row[] = [];
  for (const row of features) {
    const context = `${claims.get(row)}: ${String(row.name)}`;
    const uncounted = UNCOUNTED_CHOICES[uncountedKey(row)];
    const blocks = choiceBlocks(JSON.parse(String(row.json)), uncounted !== undefined);
    if (uncounted && blocks.length === 0) {
      throw new Error(`${context}: names no options block without a count`);
    }
    for (const block of blocks) {
      const count = block.count ?? 1;
      if (count !== 1) {
        throw new Error(`${context}: an options block picks ${String(count)}, not 1`);
      }
      if (uncounted?.follows) {
        row.follows_name = uncounted.follows.name;
        row.follows_source = uncounted.follows.source;
        followers.push(row);
      } else {
        row.choose = count;
      }
      markOptions(row, block, byKey, context);
    }
  }
  for (const row of followers) checkFollower(row, features, claims);
}

function markOptions(row: Row, block: Entry, byKey: Map<string, Row>, context: string): void {
  for (const entry of block.entries as Entry[]) {
    const target = optionRow(row, entry, byKey, context);
    target.offered_by_name = row.name;
    target.offered_by_source = row.source;
  }
}

/**
 * Refuses a follower unless it names exactly one choice of its own class and subclass,
 * and every option it offers shares a name with one that choice offers: an option no
 * choice can name would never be listed.
 */
function checkFollower(row: Row, features: Row[], claims: Map<Row, string>): void {
  const context = `${claims.get(row)}: ${String(row.name)}`;
  const owner = (each: Row) => ownerOf(each).replace(/\|[^|]*$/, "");
  const offers = (offering: Row) =>
    features.filter(
      (each) =>
        owner(each) === owner(offering) &&
        each.level === offering.level &&
        each.offered_by_name === offering.name &&
        each.offered_by_source === offering.source,
    );
  const leaders = features.filter(
    (each) =>
      owner(each) === owner(row) &&
      each.name === row.follows_name &&
      each.source === row.follows_source &&
      each.choose !== undefined,
  );
  const [leader] = leaders;
  if (leaders.length !== 1 || !leader) {
    throw new Error(
      `${context}: follows ${String(row.follows_name)}, a choice found ${leaders.length} times`,
    );
  }
  const names = new Set(offers(leader).map((each) => each.name));
  const stray = offers(row).find((each) => !names.has(each.name));
  if (stray) {
    throw new Error(
      `${context}: option ${String(stray.name)} matches none ${String(leader.name)} offers`,
    );
  }
}
