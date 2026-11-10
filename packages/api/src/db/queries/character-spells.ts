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
  catalogRef,
  classLevels,
  displayName,
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

/** Scans the serialized text, whose key order is the order the entries print in. */
function damageFacts(json: Record<string, unknown>) {
  const dice = DAMAGE_TAG.exec(JSON.stringify(json.entries ?? []))?.[1]?.trim();
  return {
    ...(dice && { damageDice: dice }),
    damageTypes: pick(spellEffectSchema.shape.damageInflict, json.damageInflict),
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
 * The spells equipped items let the character cast, in inventory order, each marked granted
 * and citing its item. A spell `known` holds by `entryKey` stays as that entry, and one
 * several items attach lists once, citing them all. An item may add spells by the alignment of
 * the character's deity row; a character with no deity, or an unknown one, gets none. An item
 * that waits on attunement lists none until attuned. A name no row answers is left out: no
 * definition entry holds it, so the sheet has nothing to repair.
 */
function itemSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
  known: ReadonlySet<string>,
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
    if (known.has(key)) return;
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
 * then its equipped items'. A granted entry a subclass also gives carries the subclass's cost.
 */
export function resolveCharacterSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterSpells {
  const rows = rowFacts(dataDir, homebrewDb, definition.spells);
  const bySubclass = subclassSpells(dataDir, definition);
  const known = new Set<string>();
  const spells: SheetSpell[] = definition.spells.map((entry, index) => {
    if ("homebrewId" in entry.ref) return sheetSpell(entry, rows[index]);
    known.add(entryKey(entry.ref));
    const cost = entry.granted ? bySubclass.get(entryKey(entry.ref))?.cost : undefined;
    return sheetSpell(entry, rows[index], cost && { cost });
  });
  const subclass = [...bySubclass].flatMap(([key, { row, subclass, cost }]) => {
    if (known.has(key)) return [];
    known.add(key);
    const ref = { name: row.name, source: row.source };
    return [
      sheetSpell({ ref, prepared: true, granted: true }, catalogFacts(row), {
        fromSubclass: subclass,
        ...(cost && { cost }),
      }),
    ];
  });
  return {
    spells: [...spells, ...subclass, ...itemSpells(dataDir, homebrewDb, definition, known)],
  };
}
