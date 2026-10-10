/**
 * The advantage and disadvantage an item grants its bearer, which 5etools states only in
 * rules text and so cannot be read off a field. The effects are our own short labels keyed by
 * `(name, source)`, never upstream prose. `ITEM_ADVANTAGES` is hand-kept: the item rows it
 * names are found by searching the catalog for rules text that mentions advantage or
 * disadvantage, and the tests in `packages/content` repeat that search against `vendor/`.
 *
 * Only an effect that is always on while the item is worn, held or carried is listed. An effect
 * the bearer must activate, a consumable's, and one that changes another creature's roll
 * rather than the bearer's stay out.
 */
import { ABILITIES, ADVANTAGE_MODES, ADVANTAGE_ROLLS } from "@dnd/rules";
import { z } from "zod";

const abilitySchema = z.enum(ABILITIES);

/**
 * One effect. `target` is the ability a `save` or a `check` applies to, absent for all of
 * them, and the skill's name for a `skill`; an `attack` has none. `condition` is the short
 * text of a conditional effect, such as `against spells`, and absent for an unconditional one.
 */
export const itemAdvantageSchema = z
  .strictObject({
    mode: z.enum(ADVANTAGE_MODES),
    roll: z.enum(ADVANTAGE_ROLLS),
    target: z.string().min(1).optional(),
    condition: z.string().min(1).max(100).optional(),
  })
  .refine(
    ({ roll, target }) => {
      if (roll === "skill") return target !== undefined;
      if (roll === "attack") return target === undefined;
      return target === undefined || abilitySchema.safeParse(target).success;
    },
    {
      message: "a skill names its skill, an attack names nothing, a save or check names an ability",
    },
  );

export type ItemAdvantage = z.infer<typeof itemAdvantageSchema>;

type Mode = ItemAdvantage["mode"];
type Ability = (typeof ABILITIES)[number];

const effect = (
  mode: Mode,
  roll: ItemAdvantage["roll"],
  target?: string,
  condition?: string,
): ItemAdvantage => ({
  mode,
  roll,
  ...(target && { target }),
  ...(condition && { condition }),
});

const save = (mode: Mode, ability?: Ability, condition?: string) =>
  effect(mode, "save", ability, condition);
const skill = (mode: Mode, name: string, condition?: string) =>
  effect(mode, "skill", name, condition);
const check = (mode: Mode, ability?: Ability, condition?: string) =>
  effect(mode, "check", ability, condition);
const attack = (mode: Mode, condition?: string) => effect(mode, "attack", undefined, condition);

const ADV = "advantage";
const DIS = "disadvantage";

const DRAGON_SCALE_MAIL = [
  "Black",
  "Blue",
  "Brass",
  "Bronze",
  "Copper",
  "Gold",
  "Green",
  "Red",
  "Silver",
  "White",
].map((color) => `${color} Dragon Scale Mail|DMG`);

const ELEMENTAL_RINGS = ["Air", "Earth", "Fire", "Water"];

/** Items that share their effects, as `Name|SOURCE`. */
const GROUPS: { items: string[]; effects: ItemAdvantage[] }[] = [
  // Saving throws against a kind of effect
  {
    items: ["Mantle of Spell Resistance|DMG", "Scarab of Protection|DMG", "Staff of the Magi|DMG"],
    effects: [save(ADV, undefined, "against spells")],
  },
  {
    items: [
      "Mantle of Spell Resistance|XDMG",
      "Ring of Spell Turning|XDMG",
      "Scarab of Protection|XDMG",
      "Staff of the Magi|XDMG",
    ],
    effects: [save(ADV, undefined, "against spells")],
  },
  {
    items: ["Ring of Spell Turning|DMG"],
    effects: [save(ADV, undefined, "against a spell that targets only you")],
  },
  {
    items: [
      "Ebonbane|RHW",
      "Holy Avenger|DMG",
      "Holy Avenger|XDMG",
      "Nepenthe|VRGR",
      "Nether Scroll of Azumar|CM",
      "Robe of the Archmagi|DMG",
      "Robe of the Archmagi|XDMG",
      "Spellguard Shield|DMG",
      "Spellguard Shield|XDMG",
    ],
    effects: [save(ADV, undefined, "against spells and other magical effects")],
  },
  {
    items: [...DRAGON_SCALE_MAIL],
    effects: [save(ADV, undefined, "against the Frightful Presence and breath weapons of dragons")],
  },
  {
    items: ["Dragonguard|LMoP", "Dragonguard|PaBTSO"],
    effects: [save(ADV, undefined, "against dragon breath weapons")],
  },
  {
    items: ["Dragonstaff of Ahghairon|WDH"],
    effects: [save(ADV, undefined, "against the spells and breath weapons of dragons")],
  },
  {
    items: ["Amulet of Protection from Turning|TftYP"],
    effects: [save(ADV, undefined, "against effects that turn undead")],
  },
  {
    items: ["Lost Crown of Besilmer|PotA"],
    effects: [save(ADV, undefined, "against effects that would charm you")],
  },
  {
    items: ["Feywrought Armor|BMT"],
    effects: [save(ADV, undefined, "to avoid or end the charmed condition")],
  },
  {
    items: ["Gloomwrought Armor|BMT"],
    effects: [save(ADV, undefined, "to avoid or end the frightened condition")],
  },
  {
    items: ["Bracers of Celerity|PaBTSO"],
    effects: [save(ADV, undefined, "to avoid or end the paralyzed or restrained condition")],
  },
  {
    items: ["Obsidian Flint Dragon Plate|BGDIA"],
    effects: [
      save(ADV, undefined, "to avoid or end the grappled condition"),
      check(ADV, undefined, "to avoid or end the grappled condition"),
    ],
  },
  {
    items: ["Necklace of Adaptation|XDMG", "Periapt of Health|XDMG"],
    effects: [save(ADV, undefined, "to avoid or end the poisoned condition")],
  },
  {
    items: ["Necklace of Adaptation|DMG", "Survival Mantle|VGM", "Ventilating Lungs|ERLW"],
    effects: [save(ADV, undefined, "against harmful gases")],
  },
  {
    items: ["Blanket|XPHB"],
    effects: [save(ADV, undefined, "against extreme cold")],
  },
  {
    items: ["Belt of Dwarvenkind|DMG"],
    effects: [
      skill(ADV, "Persuasion", "to interact with dwarves"),
      save(ADV, undefined, "against poison, if you are not a dwarf"),
    ],
  },
  {
    items: ["Belt of Dwarvenkind|XDMG"],
    effects: [
      skill(ADV, "Persuasion", "to interact with dwarves and duergar"),
      save(ADV, undefined, "to avoid or end the poisoned condition, if you are not a dwarf"),
    ],
  },
  {
    items: ["Demon Armor|DMG", "Demon Armor|XDMG"],
    effects: [
      attack(DIS, "against demons"),
      save(DIS, undefined, "against the spells and special abilities of demons"),
    ],
  },
  {
    items: ["Shrieking Greaves|BMT"],
    effects: [save(ADV, "dex"), save(DIS, undefined, "to avoid or end the frightened condition")],
  },

  // Saving throws by ability
  { items: ["Amethyst Lodestone|FTD"], effects: [save(ADV, "str")] },
  { items: ["Infernal Amulet|CoA"], effects: [save(DIS, "str"), check(DIS, "str")] },
  {
    items: ["Greater Silver Sword|MTF", "Mind Carapace Armor|VGM", "Mindguard Crown|PaBTSO"],
    effects: [save(ADV, "int"), save(ADV, "wis"), save(ADV, "cha")],
  },
  {
    items: ["Zephyr Armor|BGG"],
    effects: [skill(ADV, "Acrobatics"), save(ADV, "dex")],
  },

  // Skills and ability checks
  {
    items: ["Boots of Elvenkind|DMG"],
    effects: [skill(ADV, "Stealth", "to move silently")],
  },
  {
    items: [
      "Boots of Elvenkind|XDMG",
      "Cloak of the Bat|DMG",
      "Cloak of the Bat|XDMG",
      "Cloak of Elvenkind|XDMG",
      "Kagonesti Forest Shroud|DSotDQ",
      "Shadowfell Brand Tattoo|TCE",
    ],
    effects: [skill(ADV, "Stealth")],
  },
  {
    items: [
      "Cloak of Elvenkind|DMG",
      "Piwafwi (Cloak of Elvenkind)|OotA",
      "Piwafwi of Fire Resistance|OotA",
    ],
    effects: [skill(ADV, "Stealth", "to hide, with the hood up")],
  },
  {
    items: ["Shard of the Ise Rune|SKT"],
    effects: [skill(ADV, "Stealth", "in snowy terrain")],
  },
  {
    items: ["Winter Camouflage|FRHoF"],
    effects: [skill(ADV, "Stealth", "in an appropriate environment")],
  },
  {
    items: [
      "Eyes of the Eagle|DMG",
      "Eyes of the Eagle|XDMG",
      "Knave's Eye Patch|WDH",
      "Robe of Eyes|DMG",
      "Robe of Eyes|XDMG",
      "Watchful Helm|CM",
    ],
    effects: [skill(ADV, "Perception", "that rely on sight")],
  },
  {
    items: [
      "Rod of Alertness|DMG",
      "Rod of Alertness|XDMG",
      "Sentinel Shield|DMG",
      "Sentinel Shield|XDMG",
      "Ioun Stone, Awareness|XDMG",
    ],
    effects: [skill(ADV, "Perception")],
  },
  {
    items: ["Sorcerous Spyglass|XMtS"],
    effects: [skill(ADV, "Perception", "to detect things you can see")],
  },
  {
    items: [
      "Verminshroud (Dormant)|EGW",
      "Verminshroud (Awakened)|EGW",
      "Verminshroud (Exalted)|EGW",
    ],
    effects: [skill(ADV, "Perception", "that rely on smell")],
  },
  {
    items: [
      "Danoth's Visor (Dormant)|EGW",
      "Danoth's Visor (Awakened)|EGW",
      "Danoth's Visor (Exalted)|EGW",
    ],
    effects: [
      skill(ADV, "Investigation", "that rely on sight"),
      skill(ADV, "Perception", "that rely on sight"),
    ],
  },
  {
    items: ["Eyes of Minute Seeing|DMG", "Eyes of Minute Seeing|XDMG"],
    effects: [skill(ADV, "Investigation", "that rely on sight, up close")],
  },
  {
    items: ["Stonespeaker Crystal|OotA"],
    effects: [skill(ADV, "Investigation")],
  },
  {
    items: ["Goggles of Object Reading|EGW"],
    effects: [skill(ADV, "Arcana", "to reveal information about a creature or object you see")],
  },
  {
    items: ["Talisman of the Sphere|XDMG"],
    effects: [skill(ADV, "Arcana", "to control a Sphere of Annihilation")],
  },
  {
    items: ["Ring of Truth Telling|WDH"],
    effects: [skill(ADV, "Insight", "to tell whether someone is lying to you")],
  },
  {
    items: [
      "Grovelthrash (Dormant)|EGW",
      "Grovelthrash (Awakened)|EGW",
      "Grovelthrash (Exalted)|EGW",
    ],
    effects: [skill(ADV, "Insight", "to discern a lie in a language you understand")],
  },
  { items: ["Sword of Zariel|BGDIA"], effects: [skill(ADV, "Insight")] },
  {
    items: [
      "The Bloody End (Dormant)|EGW",
      "The Bloody End (Awakened)|EGW",
      "The Bloody End (Exalted)|EGW",
    ],
    effects: [skill(ADV, "Intimidation")],
  },
  { items: ["Far Gear|AI"], effects: [skill(ADV, "Intimidation")] },
  {
    items: ["Pirate's Cutlass|XMtS"],
    effects: [skill(ADV, "Intimidation", "when brandished")],
  },
  {
    items: ["Dread Helm|WttHC"],
    effects: [skill(ADV, "Intimidation", "against a humanoid who sees you wearing it")],
  },
  {
    items: ["Cloak of Billowing|WttHC"],
    effects: [skill(ADV, "Performance", "to amuse humanoids while the cloak is billowing")],
  },
  {
    items: ["Quarterstaff of the Acrobat|XDMG"],
    effects: [skill(ADV, "Acrobatics")],
  },
  { items: ["Wayfarer's Boots|BGG"], effects: [skill(ADV, "Survival")] },
  {
    items: ["Bob|ToA"],
    effects: [skill(ADV, "Athletics", "to swim")],
  },
  {
    items: ["Prying Blade|XMtS"],
    effects: [skill(ADV, "Athletics", "to climb or to escape while restrained")],
  },
  {
    items: ["Pole|XPHB"],
    effects: [skill(ADV, "Athletics", "to vault a High or Long Jump with the pole")],
  },
  {
    items: ["Amulet of Duplicity|CoA"],
    effects: [skill(DIS, "Persuasion", "to reveal who you really are")],
  },
  {
    items: ["Teeth of Dahlver-Nar|TCE"],
    effects: [skill(DIS, "Insight"), skill(DIS, "Perception")],
  },
  {
    items: ["Book of Exalted Deeds|DMG"],
    effects: [
      skill(ADV, "Persuasion", "to interact with good creatures"),
      skill(ADV, "Intimidation", "to interact with evil creatures"),
    ],
  },
  {
    items: ["Book of Exalted Deeds|XDMG"],
    effects: [skill(ADV, "Persuasion")],
  },
  {
    items: ["Book of Vile Darkness|DMG", "Book of Vile Darkness (Variant)|KftGV"],
    effects: [
      skill(ADV, "Persuasion", "to interact with evil creatures"),
      skill(ADV, "Intimidation", "to interact with non-evil creatures"),
    ],
  },
  {
    items: ["Black Dragon Mask|HotDQ"],
    effects: [check(ADV, "cha", "against black dragons")],
  },
  {
    items: ["Blue Dragon Mask|RoTOS"],
    effects: [check(ADV, "cha", "against blue dragons")],
  },
  {
    items: ["Green Dragon Mask|RoTOS"],
    effects: [check(ADV, "cha", "against green dragons")],
  },
  {
    items: ["Red Dragon Mask|RoTOS"],
    effects: [check(ADV, "cha", "against red dragons")],
  },
  {
    items: ["White Dragon Mask|RoTOS"],
    effects: [check(ADV, "cha", "against white dragons")],
  },
  {
    items: ["Orb of the Veil|EGW"],
    effects: [check(ADV, "wis", "to find hidden doors and paths")],
  },
  {
    items: ["Elder Cartographer's Glossography|AI"],
    effects: [
      check(ADV, "int", "about geographical features or locations"),
      check(ADV, "wis", "about geographical features or locations"),
    ],
  },
  {
    items: ["Akmon, Hammer of Purphoros|MOT"],
    effects: [check(ADV, undefined, "made with smith's tools")],
  },
  {
    items: ["Baba Yaga's Mortar and Pestle|TCE"],
    effects: [check(ADV, undefined, "made using it as one of its tools")],
  },
  {
    items: [
      "Infiltrator's Key (Dormant)|EGW",
      "Infiltrator's Key (Awakened)|EGW",
      "Infiltrator's Key (Exalted)|EGW",
    ],
    effects: [check(ADV, undefined, "to open locks")],
  },
  {
    items: ["Infiltrator's Key (Awakened)|EGW", "Infiltrator's Key (Exalted)|EGW"],
    effects: [skill(ADV, "Stealth", "to move silently")],
  },
  {
    items: ["Costume|XPHB"],
    effects: [check(ADV, undefined, "to impersonate who the costume represents")],
  },
  {
    items: ["Cultist's Robe|HotB"],
    effects: [check(ADV, undefined, "to impersonate a cultist in the Cult of Chaos")],
  },
  {
    items: ["Garb of Light and Shadow|FRHoF"],
    effects: [check(ADV, undefined, "to influence the Fey of its Domain of Delight")],
  },
  {
    items: ["Genie Robe|FRHoF"],
    effects: [check(ADV, undefined, "to influence the Elementals of its plane")],
  },
  {
    items: ["Crowbar|PHB", "Crowbar|XPHB"],
    effects: [check(ADV, "str", "where the crowbar's leverage applies")],
  },
  {
    items: ["Magnifying Glass|PHB", "Magnifying Glass|XPHB"],
    effects: [check(ADV, undefined, "to appraise or inspect a small or highly detailed item")],
  },
  {
    items: ["Military Saddle|PHB", "Military Saddle|XPHB"],
    effects: [check(ADV, undefined, "to remain mounted")],
  },
  {
    items: ["Rope of Climbing|DMG", "Rope of Climbing|XDMG"],
    effects: [check(ADV, undefined, "to climb the knotted rope")],
  },
  {
    items: ["Whelm|DMG"],
    effects: [
      attack(DIS, "while you can see the daytime sky"),
      save(DIS, undefined, "while you can see the daytime sky"),
      check(DIS, undefined, "while you can see the daytime sky"),
    ],
  },

  // Attack rolls
  {
    items: ["Oathbow|DMG", "Oathbow|XDMG"],
    effects: [
      attack(ADV, "ranged, against your sworn enemy"),
      attack(DIS, "with all other weapons"),
    ],
  },
  {
    items: [
      "Berserker Axe|XDMG",
      "Demonbone Polearm|CoA",
      "Javelin of Backbiting|TftYP",
      "Spear of Backbiting|TftYP",
      "Stygian Spear|CoA",
      "Sword of Retribution|CoA",
      "Sword of Vengeance|DMG",
      "Sword of Vengeance|XDMG",
    ],
    effects: [attack(DIS, "with weapons other than this one")],
  },
  {
    items: ["Berserker Axe|DMG", "Tloques' Berserker Battleaxe|TftYP"],
    effects: [attack(DIS, "with other weapons, unless no foe is within 60 feet")],
  },
  {
    items: ["Bloodseeker Ammunition|BMT"],
    effects: [attack(ADV, "ranged, against a creature below its full hit points")],
  },
  {
    items: ["Dyrrn's Tentacle Whip|ERLW"],
    effects: [attack(DIS, "with this weapon against aberrations")],
  },
  {
    items: ["Tidecaller Trident|BMT"],
    effects: [attack(ADV, "with this weapon while underwater")],
  },
  {
    items: ["Lance|PHB"],
    effects: [attack(DIS, "with a lance against a target within 5 feet")],
  },
  {
    items: ELEMENTAL_RINGS.map((plane) => `Ring of ${plane} Elemental Command|DMG`),
    effects: [attack(ADV, "against elementals of its plane")],
  },
  {
    items: ELEMENTAL_RINGS.map((plane) => `Ring of Elemental Command (${plane})|XDMG`),
    effects: [attack(ADV, "against elementals")],
  },
];

export type ItemAdvantageRow = { name: string; source: string; effects: readonly ItemAdvantage[] };

/** Splits `Name|SOURCE` at its last bar, since a name may hold one. */
function splitKey(key: string): { name: string; source: string } {
  const bar = key.lastIndexOf("|");
  return { name: key.slice(0, bar), source: key.slice(bar + 1) };
}

/** Every mapped item with all the effects the groups give it, in the order first listed. */
export const ITEM_ADVANTAGES: readonly ItemAdvantageRow[] = (() => {
  const rows = new Map<string, ItemAdvantageRow & { effects: ItemAdvantage[] }>();
  for (const { items, effects } of GROUPS) {
    for (const key of items) {
      const row = rows.get(key) ?? { ...splitKey(key), effects: [] };
      row.effects.push(...effects);
      rows.set(key, row);
    }
  }
  return [...rows.values()];
})();

const BY_KEY = new Map(ITEM_ADVANTAGES.map((row) => [`${row.name}|${row.source}`, row.effects]));

/** The effects the mapping gives the catalog item `(name, source)`, or none. */
export function itemAdvantagesOf(name: string, source: string): readonly ItemAdvantage[] {
  return BY_KEY.get(`${name}|${source}`) ?? [];
}
