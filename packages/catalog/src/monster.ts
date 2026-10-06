/**
 * A monster's stat block, and its legendary group's lair, as the `entries` a catalog
 * detail renders. The block reads in printed order: size, type and alignment; armor
 * class, hit points and speed; the six abilities as a table; the lines from saving throws
 * to challenge; then a named section per group of traits and actions. A field the
 * monster lacks leaves its line out. Upstream's prose passes through with its `{@tag}`
 * markup, which the renderer reads.
 */
import { ABILITIES, abilityModifier } from "@dnd/rules";
import { type Entries, entriesSchema } from "./entry.ts";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const text = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? `${value}` : undefined;

const texts = (values: unknown[]): string[] => values.flatMap((value) => text(value) || []);

const signed = (value: number) => (value < 0 ? `${value}` : `+${value}`);

export const line = (label: string, value: string | undefined): Entries =>
  value ? [`{@b ${label}} ${value}`] : [];

const SIZES: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

/** A tag's prefix shows unless upstream hides it: `Shield dwarf`, but plain `dwarf`. */
function creatureTag(tag: unknown): string | undefined {
  if (!isRecord(tag)) return text(tag);
  const prefix = tag.prefixHidden === true ? undefined : text(tag.prefix);
  return texts([prefix, tag.tag]).join(" ") || undefined;
}

/** The creature types a swarm names whose plural is not the type plus an `s`. */
const PLURALS: Record<string, string> = { monstrosity: "monstrosities", undead: "undead" };

function creatureType(type: unknown): string | undefined {
  if (!isRecord(type)) return text(type);
  const base = isRecord(type.type) ? texts(list(type.type.choose)).join(" or ") : text(type.type);
  if (!base) return undefined;
  const swarm = text(type.swarmSize);
  const kind = swarm ? `swarm of ${SIZES[swarm] ?? swarm} ${PLURALS[base] ?? `${base}s`}` : base;
  const tags = list(type.tags).flatMap((tag) => creatureTag(tag) ?? []);
  return tags.length > 0 ? `${kind} (${tags.join(", ")})` : kind;
}

const ALIGNMENT_WORDS: Record<string, string> = {
  L: "lawful",
  NX: "neutral",
  C: "chaotic",
  G: "good",
  NY: "neutral",
  E: "evil",
  N: "neutral",
  U: "unaligned",
  A: "any alignment",
};

/** A range spanning one axis whole and part of the other, keyed by its letters in sorted order. */
const ALIGNMENT_RANGES: Record<string, string> = {
  "C G L NX": "any good alignment",
  "C E L NX": "any evil alignment",
  "C E L NX NY": "any non-good alignment",
  "C G L NX NY": "any non-evil alignment",
  "E G L NY": "any lawful alignment",
  "C E G NY": "any chaotic alignment",
  "C E G NX NY": "any non-lawful alignment",
  "E G L NX NY": "any non-chaotic alignment",
};

export function alignmentWords(letters: string[]): string {
  const range = ALIGNMENT_RANGES[[...letters].sort().join(" ")];
  if (range) return range;
  return [...new Set(letters.map((letter) => ALIGNMENT_WORDS[letter] ?? letter))].join(" ");
}

/** Letters, or a choice of alignments each with its chance or note, or prose. */
function alignment(json: Json): string | undefined {
  const parts = list(json.alignment);
  if (parts.length === 0) return undefined;
  const words = parts.every((part) => typeof part === "string")
    ? alignmentWords(parts as string[])
    : parts
        .flatMap((part) => {
          if (!isRecord(part)) return text(part) ?? [];
          if (part.special !== undefined) return text(part.special) ?? [];
          const chance = text(part.chance);
          return texts([
            alignmentWords(texts(list(part.alignment))),
            chance && `(${chance}%)`,
            part.note,
          ]).join(" ");
        })
        .join(" or ");
  return `${text(json.alignmentPrefix) ?? ""}${words}`;
}

function sizeTypeAlignment(json: Json): string | undefined {
  const sizes = (Array.isArray(json.size) ? json.size : [json.size]).flatMap(
    (size) => SIZES[`${size}`] ?? [],
  );
  const kind = texts([sizes.join(" or "), creatureType(json.type)]).join(" ");
  const shown = texts([kind, alignment(json)]).join(", ");
  return shown ? `{@i ${shown.charAt(0).toUpperCase()}${shown.slice(1)}}` : undefined;
}

/** A bracketed armor class qualifies the one before it: `12 (15 with mage armor)`. */
function armorClass(ac: unknown): string | undefined {
  return (
    list(ac)
      .map((one): [string | undefined, boolean] => {
        if (!isRecord(one)) return [text(one), false];
        if (one.special !== undefined) return [text(one.special), false];
        const from = texts(list(one.from)).join(", ");
        const value = texts([one.ac, from && `(${from})`, one.condition]).join(" ");
        return one.braces === true ? [`(${value})`, true] : [value, false];
      })
      .reduce(
        (all, [value, braced]) =>
          value === undefined ? all : all ? `${all}${braced ? " " : ", "}${value}` : value,
        "",
      ) || undefined
  );
}

function hitPoints(hp: unknown): string | undefined {
  if (!isRecord(hp)) return undefined;
  if (hp.special !== undefined) return text(hp.special);
  const formula = text(hp.formula);
  return texts([hp.average, formula && `(${formula})`]).join(" ") || undefined;
}

const SPEED_MODES = ["walk", "burrow", "climb", "fly", "swim"];

function speedValue(value: unknown, hover: boolean): string | undefined {
  if (typeof value === "number") return `${value} ft.${hover ? " (hover)" : ""}`;
  if (!isRecord(value) || typeof value.number !== "number") return undefined;
  return texts([`${value.number} ft.`, value.condition]).join(" ");
}

function speed(speed: unknown): string | undefined {
  if (!isRecord(speed)) return undefined;
  const alternate = isRecord(speed.alternate) ? speed.alternate : {};
  const parts = SPEED_MODES.flatMap((mode) =>
    [
      speedValue(speed[mode], mode === "fly" && speed.canHover === true),
      ...list(alternate[mode]).map((value) => speedValue(value, false)),
    ].flatMap((value) => (value === undefined ? [] : mode === "walk" ? value : `${mode} ${value}`)),
  );
  if (isRecord(speed.choose)) {
    const { from, amount, note } = speed.choose;
    parts.push(texts([texts(list(from)).join(" or "), `${text(amount)} ft.`, note]).join(" "));
  }
  return parts.join(", ") || undefined;
}

const abilityLabel = (ability: string) => ability.charAt(0).toUpperCase() + ability.slice(1);

/** The six scores, each with its modifier; absent where the monster prints none. */
function abilityTable(json: Json): Entries {
  if (!ABILITIES.some((ability) => typeof json[ability] === "number")) return [];
  const cell = (score: unknown) =>
    typeof score === "number" ? `${score} (${signed(abilityModifier(score))})` : "—";
  return [
    {
      type: "table",
      colLabels: ABILITIES.map((ability) => ability.toUpperCase()),
      rows: [ABILITIES.map((ability) => cell(json[ability]))],
    },
  ];
}

function saves(save: unknown): string | undefined {
  if (!isRecord(save)) return undefined;
  const held = ABILITIES.filter((ability) => text(save[ability]) !== undefined);
  return (
    held.map((ability) => `${abilityLabel(ability)} ${text(save[ability])}`).join(", ") || undefined
  );
}

/** A skill as printed: each word capitalized but `of`, as in `Sleight of Hand`. */
const titled = (name: string) => name.replace(/\b(?!of\b)[a-z]/g, (letter) => letter.toUpperCase());

const bonuses = (skills: Json) =>
  Object.entries(skills).flatMap(([name, bonus]) =>
    typeof bonus === "string" ? `${titled(name)} ${bonus}` : [],
  );

/** `other` holds a choice: `oneOf` names skills the monster has one of. */
function skills(skill: unknown): string | undefined {
  if (!isRecord(skill)) return undefined;
  const choices = list(skill.other).flatMap((other) =>
    isRecord(other) && isRecord(other.oneOf)
      ? `plus one of the following: ${bonuses(other.oneOf).join(", ")}`
      : [],
  );
  return [...bonuses(skill), ...choices].join(", ") || undefined;
}

/**
 * A damage or condition list: plain names, or a group of them qualified by a note before
 * or after, under the same `key` the list sits under. A semicolon parts a group from its
 * neighbors, and a comma parts two plain names: `fire, poison; bludgeoning, ... from
 * nonmagical attacks`.
 */
function defenses(value: unknown, key: string): string | undefined {
  const parts = list(value).flatMap((one): { shown: string; grouped: boolean }[] => {
    const shown = !isRecord(one)
      ? text(one)
      : one.special !== undefined
        ? text(one.special)
        : texts([one.preNote, defenses(one[key], key), one.note]).join(" ");
    return shown ? [{ shown, grouped: isRecord(one) }] : [];
  });
  return (
    parts
      .map(({ shown, grouped }, at) =>
        at === 0 ? shown : `${grouped || parts[at - 1]?.grouped ? "; " : ", "}${shown}`,
      )
      .join("") || undefined
  );
}

function senses(json: Json): string | undefined {
  const passive = text(json.passive);
  return (
    [...texts(list(json.senses)), ...(passive ? [`passive Perception ${passive}`] : [])].join(
      ", ",
    ) || undefined
  );
}

/** A rating, and the one a lair or a coven raises it to. */
function challenge(cr: unknown): string | undefined {
  if (!isRecord(cr)) return text(cr);
  const lair = text(cr.lair);
  const coven = text(cr.coven);
  const raised = texts([lair && `${lair} in its lair`, coven && `${coven} as part of a coven`]);
  return texts([cr.cr, raised.length > 0 && `(or ${raised.join(", or ")})`]).join(" ") || undefined;
}

const ORDINALS = ["", "1st", "2nd", "3rd"];

const ordinal = (level: string) => ORDINALS[Number(level)] ?? `${level}th`;

const spellNames = (spells: unknown) =>
  list(spells)
    .flatMap((spell) =>
      isRecord(spell)
        ? spell.hidden === true
          ? []
          : (text(spell.entry) ?? [])
        : (text(spell) ?? []),
    )
    .join(", ");

/** A spell level's label, its slots counted. Pact slots all sit at the top level of a range. */
function spellLevel(level: string, at: Json): string {
  if (level === "0") return "Cantrips (at will):";
  const top = ordinal(level);
  const lower = text(at.lower);
  const pact = lower !== undefined && lower !== level;
  const slots = text(at.slots);
  const count = slots
    ? ` (${slots}${pact ? ` ${top}-level` : ""} ${slots === "1" ? "slot" : "slots"})`
    : "";
  return `${pact ? `${ordinal(lower)}-${top}` : top} level${count}:`;
}

/** The per-use spell lists upstream keys by how often each refreshes, or what each costs. */
const PER: Record<string, (uses: number) => string> = {
  daily: (uses) => `${uses}/day`,
  rest: (uses) => `${uses}/rest`,
  restLong: (uses) => `${uses}/long rest`,
  weekly: (uses) => `${uses}/week`,
  yearly: (uses) => `${uses}/year`,
  charges: (uses) => `${uses} ${uses === 1 ? "charge" : "charges"}`,
};

/**
 * One spellcasting block as a named section: its header, a line per frequency or spell
 * level, then its footer. A frequency upstream marks `hidden` is spelled out in the
 * header already, as `Misty Step (3/Day)` is.
 */
function spellcasting(block: Json): Entries[number] {
  const hidden = new Set(texts(list(block.hidden)));
  const shown = (key: string) => block[key] !== undefined && !hidden.has(key);
  const item = (name: string, spells: unknown) => ({
    type: "item",
    name,
    entry: spellNames(spells),
  });
  const lines = [
    ...(shown("will") ? [item("At will:", block.will)] : []),
    ...(shown("ritual") ? [item("Rituals:", block.ritual)] : []),
    ...Object.entries(PER).flatMap(([key, label]) =>
      shown(key) && isRecord(block[key])
        ? Object.entries(block[key])
            .sort(([a], [b]) => Number.parseInt(b, 10) - Number.parseInt(a, 10))
            .map(([uses, spells]) =>
              item(
                `${label(Number.parseInt(uses, 10))}${uses.endsWith("e") ? " each" : ""}:`,
                spells,
              ),
            )
        : [],
    ),
    ...(shown("spells") && isRecord(block.spells)
      ? Object.entries(block.spells).flatMap(([level, at]) => {
          if (!isRecord(at)) return [];
          return [item(spellLevel(level, at), at.spells)];
        })
      : []),
  ];
  return {
    type: "entries",
    name: text(block.name) ?? "Spellcasting",
    entries: [
      ...(entriesSchema.safeParse(block.headerEntries).data ?? []),
      ...(lines.length > 0 ? [{ type: "list", style: "list-hang-notitle", items: lines }] : []),
      ...(entriesSchema.safeParse(block.footerEntries).data ?? []),
    ],
  };
}

/** Legendary action uses, where upstream prints no header of its own. */
function legendaryUses(json: Json): string {
  const lair = text(json.legendaryActionsLair);
  return `Legendary action uses: ${text(json.legendaryActions) ?? 3}${lair ? ` (${lair} in its lair)` : ""}.`;
}

/** Each group's heading, the field holding its items, and the `displayAs` that joins it. */
const SECTIONS = [
  { name: "Traits", key: "trait", as: "trait" },
  { name: "Actions", key: "action", as: "action" },
  { name: "Bonus Actions", key: "bonus", as: "bonus" },
  { name: "Reactions", key: "reaction", as: "reaction", header: "reactionHeader" },
  { name: "Legendary Actions", key: "legendary", as: "legendary", header: "legendaryHeader" },
  { name: "Mythic Actions", key: "mythic", header: "mythicHeader" },
];

function sections(json: Json): Entries {
  const casting = list(json.spellcasting).filter(isRecord);
  return SECTIONS.flatMap(({ name, key, as, header }) => {
    const own = list(json[key]).flatMap((one) =>
      isRecord(one) ? { type: "entries", ...one } : [],
    );
    const items: Entries = [
      ...(entriesSchema.safeParse(own).data ?? []),
      ...casting.filter((block) => (text(block.displayAs) ?? "trait") === as).map(spellcasting),
    ];
    if (items.length === 0) return [];
    const intro = header && entriesSchema.safeParse(json[header]).data;
    const lead = intro || (key === "legendary" ? [legendaryUses(json)] : []);
    return [{ type: "entries", name, entries: [...lead, ...items] }];
  });
}

/** A link to the monster's legendary group, which holds its lair actions and regional effects. */
function lair(group: unknown): Entries {
  if (!isRecord(group)) return [];
  const name = text(group.name);
  const source = text(group.source);
  if (!name || !source) return [];
  return line("Lair Actions and Regional Effects", `{@legroup ${name}|${source}}`);
}

export function monsterEntries(json: Json): Entries {
  return [
    ...texts([sizeTypeAlignment(json)]),
    ...line("Armor Class", armorClass(json.ac)),
    ...line("Hit Points", hitPoints(json.hp)),
    ...line("Speed", speed(json.speed)),
    ...abilityTable(json),
    ...line("Saving Throws", saves(json.save)),
    ...line("Skills", skills(json.skill)),
    ...line("Damage Vulnerabilities", defenses(json.vulnerable, "vulnerable")),
    ...line("Damage Resistances", defenses(json.resist, "resist")),
    ...line("Damage Immunities", defenses(json.immune, "immune")),
    ...line("Condition Immunities", defenses(json.conditionImmune, "conditionImmune")),
    ...line("Senses", senses(json)),
    ...line("Languages", texts(list(json.languages)).join(", ")),
    ...line("Challenge", challenge(json.cr)),
    ...sections(json),
    ...lair(json.legendaryGroup),
  ];
}

const LAIR_SECTIONS = [
  { name: "Lair Actions", key: "lairActions" },
  { name: "Regional Effects", key: "regionalEffects" },
  { name: "Mythic Encounter", key: "mythicEncounter" },
];

export function legendaryGroupEntries(json: Json): Entries {
  return LAIR_SECTIONS.flatMap(({ name, key }) => {
    const entries = entriesSchema.safeParse(json[key]).data ?? [];
    return entries.length > 0 ? [{ type: "entries", name, entries }] : [];
  });
}
