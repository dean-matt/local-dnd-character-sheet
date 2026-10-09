/**
 * The fixed vocabularies a homebrew form picks from, each upstream code beside the name the
 * form shows in its place. The item codes are the ones `vendor/5etools/data/items-base.json`
 * lists under `itemType` and `itemProperty`.
 */
import { DAMAGE_TYPES } from "@dnd/catalog";

/** Which fields beyond the common ones an item of a type carries. */
export type ItemGroup = "weapon" | "armor" | "gear";

/** Each type a homebrew item can take, the weapons and armor first, then the rest by name. */
export const ITEM_TYPES: { value: string; label: string; group: ItemGroup }[] = [
  { value: "M", label: "Melee weapon", group: "weapon" },
  { value: "R", label: "Ranged weapon", group: "weapon" },
  { value: "LA", label: "Light armor", group: "armor" },
  { value: "MA", label: "Medium armor", group: "armor" },
  { value: "HA", label: "Heavy armor", group: "armor" },
  { value: "S", label: "Shield", group: "armor" },
  { value: "G", label: "Adventuring gear", group: "gear" },
  { value: "A", label: "Ammunition", group: "gear" },
  { value: "AT", label: "Artisan's tools", group: "gear" },
  { value: "FD", label: "Food and drink", group: "gear" },
  { value: "GS", label: "Gaming set", group: "gear" },
  { value: "INS", label: "Instrument", group: "gear" },
  { value: "OTH", label: "Other", group: "gear" },
  { value: "P", label: "Potion", group: "gear" },
  { value: "RG", label: "Ring", group: "gear" },
  { value: "RD", label: "Rod", group: "gear" },
  { value: "SC", label: "Scroll", group: "gear" },
  { value: "SCF", label: "Spellcasting focus", group: "gear" },
  { value: "T", label: "Tools", group: "gear" },
  { value: "TG", label: "Trade good", group: "gear" },
  { value: "WD", label: "Wand", group: "gear" },
];

/** The group `type` puts an item in; a 2024 type such as `M|XPHB` reads by its code. */
export function itemGroup(type: unknown): ItemGroup {
  const code = typeof type === "string" ? type.split("|")[0] : undefined;
  return ITEM_TYPES.find((each) => each.value === code)?.group ?? "gear";
}

/** The fields only an item of a group carries, dropped when its type leaves that group. */
export const GROUP_FIELDS: Record<ItemGroup, string[]> = {
  weapon: ["weaponCategory", "baseItem", "property", "dmg1", "dmg2", "dmgType", "bonusWeapon"],
  armor: ["ac", "bonusAc"],
  gear: [],
};

export const RARITIES = [
  { value: "none", label: "None (mundane)" },
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "very rare", label: "Very rare" },
  { value: "legendary", label: "Legendary" },
  { value: "artifact", label: "Artifact" },
  { value: "varies", label: "Varies" },
  { value: "unknown", label: "Unknown" },
];

export const WEAPON_CATEGORIES = [
  { value: "simple", label: "Simple" },
  { value: "martial", label: "Martial" },
];

export const WEAPON_PROPERTIES = [
  { value: "A", label: "Ammunition" },
  { value: "F", label: "Finesse" },
  { value: "H", label: "Heavy" },
  { value: "L", label: "Light" },
  { value: "LD", label: "Loading" },
  { value: "R", label: "Reach" },
  { value: "RLD", label: "Reload" },
  { value: "S", label: "Special" },
  { value: "T", label: "Thrown" },
  { value: "2H", label: "Two-handed" },
  { value: "V", label: "Versatile" },
];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** `dmgType`'s codes, each beside its name. */
export const DAMAGE_TYPE_CODES = Object.entries(DAMAGE_TYPES).map(([value, name]) => ({
  value,
  label: capitalize(name),
}));

/** The damage types a resistance or a spell names, as upstream writes them: lowercase words. */
export const DAMAGE_TYPE_NAMES = Object.values(DAMAGE_TYPES)
  .sort()
  .map((value) => ({ value, label: capitalize(value) }));

export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
].map((value) => ({ value, label: capitalize(value) }));

export const SPELL_LEVELS = [
  { value: "0", label: "Cantrip" },
  ...Array.from({ length: 9 }, (_, index) => ({
    value: String(index + 1),
    label: `Level ${index + 1}`,
  })),
];

export const CASTING_UNITS = [
  { value: "action", label: "Action" },
  { value: "bonus", label: "Bonus action" },
  { value: "reaction", label: "Reaction" },
  { value: "minute", label: "Minute" },
  { value: "hour", label: "Hour" },
];

/** A range's `distance.type`, and `special`, which upstream writes as the range's own type. */
export const RANGE_KINDS = [
  { value: "", label: "Not stated" },
  { value: "self", label: "Self" },
  { value: "touch", label: "Touch" },
  { value: "feet", label: "Feet" },
  { value: "miles", label: "Miles" },
  { value: "sight", label: "Sight" },
  { value: "unlimited", label: "Unlimited" },
  { value: "special", label: "Special" },
];

/** A range's `type`: `point` for a distance, an area's shape for an area around the caster. */
export const RANGE_SHAPES = [
  { value: "point", label: "None — a point in range" },
  { value: "cone", label: "Cone" },
  { value: "cube", label: "Cube" },
  { value: "cylinder", label: "Cylinder" },
  { value: "emanation", label: "Emanation" },
  { value: "hemisphere", label: "Hemisphere" },
  { value: "line", label: "Line" },
  { value: "radius", label: "Radius" },
  { value: "sphere", label: "Sphere" },
];

export const DURATION_TYPES = [
  { value: "", label: "Not stated" },
  { value: "instant", label: "Instantaneous" },
  { value: "timed", label: "Timed" },
  { value: "permanent", label: "Permanent" },
  { value: "special", label: "Special" },
];

export const DURATION_UNITS = [
  { value: "round", label: "Rounds" },
  { value: "minute", label: "Minutes" },
  { value: "hour", label: "Hours" },
  { value: "day", label: "Days" },
];
