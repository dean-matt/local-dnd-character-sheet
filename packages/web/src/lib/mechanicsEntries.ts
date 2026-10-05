import { ARMOR_KINDS, WEAPON_KINDS } from "./itemKind.ts";

export interface MechanicsEntry {
  label: string;
  /** The `/search` type the entry needs before it shows. */
  type: string;
  /** Set where the entry narrows items to kinds rather than naming a type alone. */
  kind?: string;
}

/**
 * The Mechanics menu's entries, alphabetical. An entry shows only once `/search/types`
 * returns its type, so a type that becomes searchable joins the menu with no change here.
 */
export const MECHANICS_ENTRIES: readonly MechanicsEntry[] = [
  { label: "Actions", type: "action" },
  { label: "Armor", type: "item", kind: ARMOR_KINDS.join(",") },
  { label: "Backgrounds", type: "background" },
  { label: "Classes", type: "class" },
  { label: "Conditions", type: "condition" },
  { label: "Deities", type: "deity" },
  { label: "Diseases", type: "disease" },
  { label: "Feats", type: "feat" },
  { label: "Items", type: "item" },
  { label: "Languages", type: "language" },
  { label: "Monsters", type: "monster" },
  { label: "Optional Features", type: "optfeature" },
  { label: "Races", type: "race" },
  { label: "Senses", type: "sense" },
  { label: "Skills", type: "skill" },
  { label: "Spells", type: "spell" },
  { label: "Subclasses", type: "subclass" },
  { label: "Tables", type: "table" },
  { label: "Variant Rules", type: "variantrule" },
  { label: "Vehicles", type: "vehicle" },
  { label: "Weapons", type: "item", kind: WEAPON_KINDS.join(",") },
];

/** The search page filtered to what `entry` names. */
export function mechanicsHref({ type, kind }: MechanicsEntry): string {
  return `/search?${new URLSearchParams(kind === undefined ? { type } : { type, kind })}`;
}
