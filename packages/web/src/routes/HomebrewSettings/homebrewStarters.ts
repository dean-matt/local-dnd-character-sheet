/**
 * The entries a new homebrew row opens with, each carrying every field the sheet reads off
 * an entry of its sort, in the shape `vendor/5etools/data/` writes it. A field upstream
 * carries that nothing here reads, such as an armor's `stealth`, is left out, so editing
 * one never looks like it changed the sheet.
 */

/** One example a new entry can start from, named for the picker. */
interface HomebrewStarter {
  label: string;
  entry: Record<string, unknown>;
}

/** At least one, so a new entry always has an example to open with. */
export type HomebrewStarters = [HomebrewStarter, ...HomebrewStarter[]];

export const ITEM_STARTERS: HomebrewStarters = [
  {
    label: "Weapon",
    entry: {
      name: "Sunfire Blade",
      type: "M",
      rarity: "rare",
      reqAttune: true,
      weight: 3,
      value: 150000,
      baseItem: "longsword|xphb",
      weaponCategory: "martial",
      property: ["V"],
      dmg1: "1d8",
      dmg2: "1d10",
      dmgType: "S",
      bonusWeapon: "+1",
      entries: [
        "You gain a +1 bonus to attack and damage rolls made with this magic weapon, and a hit with it deals an extra {@damage 1d6} fire damage.",
        "While you hold it, the blade sheds bright light in a 20-foot radius. A creature that starts its turn in that light can't be {@condition Invisible|XPHB}.",
      ],
    },
  },
  {
    label: "Armor",
    entry: {
      name: "Emberscale Breastplate",
      type: "MA",
      rarity: "very rare",
      reqAttune: true,
      weight: 20,
      value: 40000,
      ac: 14,
      bonusAc: "+1",
      resist: ["cold"],
      immune: ["fire"],
      conditionImmune: ["frightened"],
      entries: [
        "While wearing this armor, you gain a +1 bonus to AC, you have resistance to cold damage and immunity to fire damage, and you can't be {@condition Frightened|XPHB}.",
      ],
    },
  },
  {
    label: "Gear",
    entry: {
      name: "Tidewatcher's Lantern",
      type: "G",
      rarity: "none",
      weight: 2,
      value: 500,
      entries: [
        "This hooded lantern burns for 6 hours on one {@item Oil|XPHB|flask of oil}, casting bright light in a 30-foot radius and dim light for an additional 30 feet.",
      ],
    },
  },
];

export const SPELL_STARTERS: HomebrewStarters = [
  {
    label: "Spell",
    entry: {
      name: "Brinelash",
      level: 2,
      school: "V",
      time: [{ number: 1, unit: "action" }],
      range: { type: "point", distance: { type: "feet", amount: 60 } },
      components: { v: true, s: true, m: "a pinch of sea salt" },
      duration: [{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }],
      meta: { ritual: false },
      entries: [
        "A lash of seawater strikes a creature you can see within range. The target makes a Strength saving throw, taking {@damage 2d6} cold damage and falling {@condition Prone|XPHB} on a failed save, or half as much damage on a successful one.",
        "Until the spell ends, you can use a bonus action on each of your turns to strike again.",
      ],
      entriesHigherLevel: [
        {
          type: "entries",
          name: "Using a Higher-Level Spell Slot",
          entries: [
            "The damage increases by {@scaledamage 2d6|2-9|1d6} for each spell slot level above 2.",
          ],
        },
      ],
      damageInflict: ["cold"],
    },
  },
];
