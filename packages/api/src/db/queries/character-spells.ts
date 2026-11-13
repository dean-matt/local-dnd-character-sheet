/**
 * Resolves the spells one definition lists, reading `content.db` for a catalog reference
 * and `homebrew.db` for a homebrew one. A reference nothing answers stays in the list,
 * marked unresolved, for the reason `features.ts` gives.
 */
import {
  attachedSpellsByDeityAlignmentSchema,
  attachedSpellsSchema,
  type CharacterSpells,
  deityAlignmentCode,
  entriesSchema,
  grantedSpellCosts,
  grantedSpellKey,
  type SheetSpell,
  spellCastingFacts,
  spellEffectSchema,
} from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  catalogRef,
  classLevels,
  displayName,
  type EntryRef,
  entryKey,
  spellBlockKey,
} from "@dnd/character";
import type { ZodType } from "zod";
import { getCatalogRow } from "./catalog-row.ts";
import { getHomebrewSpell, type HomebrewDb } from "./homebrew.ts";
import { resolveItemRows } from "./inventory.ts";
import {
  type SpellRow as CatalogSpellRow,
  findSpells,
  type Grantor,
  getGrantedSpells,
  getGrantorJson,
  getSpells,
} from "./spells.ts";

type SpellEntry = CharacterDefinition["spells"][number];

type SpellRowFacts = {
  level: number;
  school: string;
  concentration: boolean;
  ritual: boolean;
  json: Record<string, unknown>;
};

const pick = <T>(schema: ZodType<T>, value: unknown): T | undefined => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

const DAMAGE_TAG = /\{@damage ([^|}]+)/;
const SCALE_TAG = /\{@scaledamage ([^|}]+)\|[^|}]*\|([^|}]+)\}/;

const BEAM_COUNTS = ["two", "three", "four", "five", "six"];
const BEAMS = /\b(two|three|four|five|six) beams? at (?:level )?(\d+)/g;

/** A cantrip's "two beams at 5th level" and "three beams at level 11", counted from the printed text. */
function beamTiers(json: Record<string, unknown>) {
  const text = JSON.stringify([json.entries, json.entriesHigherLevel]);
  return [...text.matchAll(BEAMS)]
    .map(([, word = "", level = ""]) => ({
      level: Number(level),
      count: BEAM_COUNTS.indexOf(word) + 2,
    }))
    .sort((a, b) => a.level - b.level);
}

/**
 * Scans the serialized text, whose key order is the order the entries print in. The upcast
 * step counts only where it scales the first roll, since a spell with two damage rolls
 * upcasts the other.
 */
function damageFacts(json: Record<string, unknown>) {
  const dice = DAMAGE_TAG.exec(JSON.stringify(json.entries ?? []))?.[1]?.trim();
  const scale = SCALE_TAG.exec(JSON.stringify(json.entriesHigherLevel ?? []));
  const upcast = scale?.[1]?.trim() === dice ? scale?.[2]?.trim() : undefined;
  const scaling = pick(spellEffectSchema.shape.scalingLevelDice, json.scalingLevelDice)?.scaling;
  const tiers = Object.entries(scaling ?? {})
    .map(([level, tier]) => ({ level: Number(level), dice: tier }))
    .filter(({ level }) => Number.isInteger(level) && level >= 1)
    .sort((a, b) => a.level - b.level);
  const beams = beamTiers(json);
  return {
    ...(dice && { damageDice: dice }),
    ...(beams.length > 0 && { beamTiers: beams }),
    damageTypes: pick(spellEffectSchema.shape.damageInflict, json.damageInflict),
    ...(pick(spellEffectSchema.shape.spellAttack, json.spellAttack) && { attack: true as const }),
    ...(tiers.length > 0 && { damageTiers: tiers }),
    ...(upcast && { damageUpcast: upcast }),
  };
}

type SpellRow = SpellRowFacts & { name: string };

function homebrewFacts(homebrewDb: HomebrewDb, id: string): SpellRow | undefined {
  const row = getHomebrewSpell(homebrewDb, id);
  return row && { ...row, json: row.json as Record<string, unknown> };
}

const catalogFacts = (row: CatalogSpellRow): SpellRow => ({
  ...row,
  concentration: row.concentration === 1,
  ritual: row.ritual === 1,
  json: JSON.parse(row.json) as Record<string, unknown>,
});

/** Every catalog row read over one connection, since a caster can list dozens. */
function rowFacts(
  dataDir: string,
  homebrewDb: HomebrewDb,
  entries: readonly SpellEntry[],
): (SpellRow | undefined)[] {
  const catalogRefs = entries.flatMap(({ ref }) => ("homebrewId" in ref ? [] : [ref]));
  const catalogRows = getSpells(dataDir, catalogRefs).values();
  return entries.map(({ ref }) => {
    if ("homebrewId" in ref) return homebrewFacts(homebrewDb, ref.homebrewId);
    const row = catalogRows.next().value;
    return row && catalogFacts(row);
  });
}

type Cost = NonNullable<SheetSpell["cost"]>;

/** What the sheet says of a spell beyond its definition entry. */
type Grant = { fromItem?: string; fromSubclass?: string; cost?: Cost };

function sheetSpell(entry: SpellEntry, row: SpellRow | undefined, grant: Grant = {}) {
  const { ref, prepared, granted, origin, pickedFor } = entry;
  const fields = {
    name: row?.name ?? displayName(ref),
    ...("homebrewId" in ref ? { homebrewId: ref.homebrewId } : { source: ref.source }),
    prepared,
    ...(granted && { granted }),
    ...grant,
    ...(origin && { origin }),
    ...(pickedFor && { pickedFor }),
  };
  if (!row) return { resolved: false as const, ...fields };
  return {
    resolved: true as const,
    ...fields,
    level: row.level,
    school: row.school,
    concentration: row.concentration,
    ritual: row.ritual,
    ...spellCastingFacts(row.json),
    ...damageFacts(row.json),
    // Upstream keeps the upcast rule apart, and dropping it makes the text read complete.
    entries: [
      ...(pick(entriesSchema, row.json.entries) ?? []),
      ...(pick(spellEffectSchema.shape.entriesHigherLevel, row.json.entriesHigherLevel) ?? []),
    ],
  };
}

type SubclassSpell = { row: CatalogSpellRow; subclass: string; cost?: Cost };

/**
 * The spells each catalog subclass the character holds gives outright by its class's level,
 * by `entryKey`, each once under the first subclass that gives it, with what casting it costs.
 * A subclass offering alternative blocks gives its chosen block's. A homebrew class or
 * subclass gives none here.
 */
function subclassSpells(
  dataDir: string,
  definition: CharacterDefinition,
): Map<string, SubclassSpell> {
  const found = new Map<string, SubclassSpell>();
  for (const group of classLevels(definition)) {
    const cls = catalogRef(group.class);
    const subclass = catalogRef(group.subclass);
    if (!cls || !subclass) continue;
    const key = spellBlockKey({ kind: "subclass", ref: subclass, class: cls });
    const block = definition.spellBlocks.find((choice) => spellBlockKey(choice.grantor) === key);
    const grantor = {
      kind: "subclass" as const,
      ...subclass,
      parent: cls,
      ...(block && { block: block.block }),
    };
    const costs = grantedSpellCosts(getGrantorJson(dataDir, grantor), grantor.block);
    const refs = getGrantedSpells(dataDir, grantor, group.level).spells;
    for (const row of getSpells(dataDir, refs)) {
      if (!row || found.has(entryKey(row))) continue;
      const cost = costs.get(grantedSpellKey(`${row.name}|${row.source}`));
      found.set(entryKey(row), { row, subclass: subclass.name, ...(cost && { cost }) });
    }
  }
  return found;
}

/**
 * The spells every catalog row but a subclass gives outright, by `entryKey`: each class at
 * its level, and the race or its subrace, the background, the feats and the optional
 * features at the character's. A homebrew row gives none here, so a granted entry only a
 * homebrew race gives still reads as its subclass's.
 */
function nonSubclassSpells(dataDir: string, definition: CharacterDefinition): Set<string> {
  const level = Math.max(1, definition.levels.length);
  const at = (
    kind: Grantor["kind"],
    ref: EntryRef | undefined,
    parent?: { race: ContentRef },
  ): { grantor: Grantor; level: number }[] => {
    const found = catalogRef(ref);
    if (!found) return [];
    const key = spellBlockKey({ kind, ref: found, ...parent });
    const block = definition.spellBlocks.find((choice) => spellBlockKey(choice.grantor) === key);
    const grantor = {
      kind,
      ...found,
      ...(parent && { parent: parent.race }),
      ...(block && { block: block.block }),
    };
    return [{ grantor, level }];
  };
  const race = catalogRef(definition.race);
  const grantors = [
    ...classLevels(definition).flatMap((group) =>
      at("class", group.class).map((each) => ({ ...each, level: group.level })),
    ),
    // A subrace's grants already hold its race's.
    ...(catalogRef(definition.subrace) && race
      ? at("subrace", definition.subrace, { race })
      : at("race", definition.race)),
    ...at("background", definition.background),
    ...definition.feats.flatMap(({ ref }) => at("feat", ref)),
    ...definition.optionalFeatures.flatMap(({ ref }) => at("optionalFeature", ref)),
  ];
  return new Set(
    grantors.flatMap(({ grantor, level }) =>
      getGrantedSpells(dataDir, grantor, level).spells.map(entryKey),
    ),
  );
}

/**
 * The spells equipped items let the character cast, in inventory order, each marked granted
 * and citing its item. A spell `picked` holds by `entryKey` stays as that entry, and one
 * several items attach lists once, citing them all. An item may add spells by the alignment of
 * the character's deity row; a character with no deity, or an unknown one, gets none. An item
 * that waits on attunement lists none until attuned. A name no row answers is left out: no
 * definition entry holds it, so the sheet has nothing to repair.
 */
function itemSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
  picked: ReadonlySet<string>,
): SheetSpell[] {
  const rows = resolveItemRows(dataDir, homebrewDb, definition.inventory);
  let deityCode: string | undefined | null = null;
  const deityAlignment = () => {
    if (deityCode !== null) return deityCode;
    const { deity } = definition;
    const row = deity && getCatalogRow(dataDir, "deity", deity.name, deity.source, deity.pantheon);
    deityCode = row ? deityAlignmentCode(JSON.parse(row.json)) : undefined;
    return deityCode;
  };
  const attached = definition.inventory.flatMap((entry, index) => {
    const row = rows[index];
    if (!row || !entry.equipped || (row.requiresAttunement && !entry.attuned)) return [];
    const byAlignment = attachedSpellsByDeityAlignmentSchema.safeParse(row.json).data;
    const code = byAlignment && deityAlignment();
    const names = [
      ...(attachedSpellsSchema.safeParse(row.json).data ?? []),
      ...((code && byAlignment[code]) || []),
    ];
    return names.map((name) => ({ item: row.name, name }));
  });
  const found = findSpells(
    dataDir,
    definition.edition,
    attached.map(({ name }) => name),
  );
  const byKey = new Map<string, { row: CatalogSpellRow; items: string[] }>();
  attached.forEach(({ item }, index) => {
    const row = found[index];
    if (!row) return;
    const key = entryKey(row);
    if (picked.has(key)) return;
    const listed = byKey.get(key);
    if (!listed) byKey.set(key, { row, items: [item] });
    else if (!listed.items.includes(item)) listed.items.push(item);
  });
  return [...byKey.values()].map(({ row, items }) => {
    const ref = { name: row.name, source: row.source };
    return sheetSpell({ ref, prepared: true, granted: true }, catalogFacts(row), {
      fromItem: items.join(", "),
    });
  });
}

/**
 * The definition's spells in order, then those its subclasses give that it does not list,
 * then its equipped items'. An entry does not record its grantor, so a granted entry a
 * subclass gives is that subclass's, carrying its cost, unless another row gives the spell
 * too: a Tiefling Shadow Monk's free Darkness stays free, and Way of Shadow's costed
 * Darkness lists beside it. An item's spell folds into an entry the character picked, and
 * lists beside every granted one, so the sheet always cites the item.
 */
export function resolveCharacterSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterSpells {
  const rows = rowFacts(dataDir, homebrewDb, definition.spells);
  const bySubclass = subclassSpells(dataDir, definition);
  const elsewhere =
    bySubclass.size > 0 ? nonSubclassSpells(dataDir, definition) : new Set<string>();
  const listed = new Set<string>();
  const picked = new Set<string>();
  const spells: SheetSpell[] = definition.spells.map((entry, index) => {
    if ("homebrewId" in entry.ref) return sheetSpell(entry, rows[index]);
    const key = entryKey(entry.ref);
    const given = entry.granted ? bySubclass.get(key) : undefined;
    const subclassOwn = given && !elsewhere.has(key);
    if (!given || subclassOwn) listed.add(key);
    if (!entry.granted) picked.add(key);
    return sheetSpell(entry, rows[index], subclassOwn && given.cost ? { cost: given.cost } : {});
  });
  const subclass = [...bySubclass].flatMap(([key, { row, subclass, cost }]) => {
    if (listed.has(key)) return [];
    const ref = { name: row.name, source: row.source };
    return [
      sheetSpell({ ref, prepared: true, granted: true }, catalogFacts(row), {
        fromSubclass: subclass,
        ...(cost && { cost }),
      }),
    ];
  });
  return {
    spells: [...spells, ...subclass, ...itemSpells(dataDir, homebrewDb, definition, picked)],
  };
}
