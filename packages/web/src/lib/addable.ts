/**
 * A row "Add to…" can land on a character: an item, a spell or a feat, named by the
 * reference the character stores. Creation and level-up own races, classes and subclasses,
 * so nothing else is addable.
 */
import type { SearchHit } from "@dnd/catalog";
import type { ContentRef, EntryRef } from "@dnd/character";
import { matchCatalogTarget } from "./catalogRows.ts";
import { displayName } from "./displayName.ts";

export interface Addable {
  kind: "item" | "spell" | "feat";
  ref: EntryRef;
  /** The magic variant laid over `ref`, its base item, as the inventory stores the pair. */
  variant?: ContentRef;
  /** How a confirmation names the row: `Fireball (PHB)`. */
  label: string;
}

const isKind = (type: string): type is Addable["kind"] =>
  type === "item" || type === "spell" || type === "feat";

const labelOf = (name: string, source: string | undefined) =>
  `${displayName(name)} (${source ?? "Homebrew"})`;

/** What a search hit adds, or `undefined` for a type nothing adds. */
export function addableHit(hit: SearchHit): Addable | undefined {
  if (!isKind(hit.type)) return undefined;
  return "id" in hit
    ? { kind: hit.type, ref: { homebrewId: hit.id }, label: labelOf(hit.name, undefined) }
    : {
        kind: hit.type,
        ref: { name: hit.name, source: hit.source },
        label: labelOf(hit.name, hit.source),
      };
}

const KINDS = new Map<string, Addable["kind"]>([
  ["items/:name/:source", "item"],
  ["spells/:name/:source", "spell"],
  ["feats/:name/:source", "feat"],
  ["items/:name/:source/variants/:variantName/:variantSource", "item"],
  ["homebrew/items/:id", "item"],
  ["homebrew/spells/:id", "spell"],
  ["homebrew/feats/:id", "feat"],
]);

/**
 * What the row at a detail address adds, named `name` and from `source`, or `undefined`
 * for an address naming anything else.
 */
export function addableAt(
  address: string,
  name: string,
  source: string | undefined,
): Addable | undefined {
  const match = matchCatalogTarget(address);
  const kind = match && KINDS.get(match.target.path);
  if (!match || !kind) return undefined;
  const { key } = match;
  return {
    kind,
    ref: key.id ? { homebrewId: key.id } : { name: key.name ?? "", source: key.source ?? "" },
    ...(key.variantName && { variant: { name: key.variantName, source: key.variantSource ?? "" } }),
    label: labelOf(name, source),
  };
}
