/**
 * Resolves the spells one definition lists, reading `content.db` for a catalog reference
 * and `homebrew.db` for a homebrew one. A reference nothing answers stays in the list,
 * marked unresolved, for the reason `features.ts` gives.
 */
import {
  attachedSpellsSchema,
  type CharacterSpells,
  entriesSchema,
  type SheetSpell,
  spellCastingFacts,
} from "@dnd/catalog";
import { type CharacterDefinition, displayName, entryKey } from "@dnd/character";
import { type ZodType, z } from "zod";
import { getHomebrewSpell, type HomebrewDb } from "./homebrew.ts";
import { resolveItemRows } from "./inventory.ts";
import { type SpellRow as CatalogSpellRow, findSpells, getSpells } from "./spells.ts";

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

const damageTypesSchema = z.array(z.string().min(1)).min(1);

/** Scans the serialized text, whose key order is the order the entries print in. */
function damageFacts(json: Record<string, unknown>) {
  const dice = DAMAGE_TAG.exec(JSON.stringify(json.entries ?? []))?.[1]?.trim();
  return {
    ...(dice && { damageDice: dice }),
    damageTypes: pick(damageTypesSchema, json.damageInflict),
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

function sheetSpell(entry: SpellEntry, row: SpellRow | undefined, fromItem?: string) {
  const { ref, prepared, granted, origin, pickedFor } = entry;
  const fields = {
    name: row?.name ?? displayName(ref),
    ...("homebrewId" in ref ? { homebrewId: ref.homebrewId } : { source: ref.source }),
    prepared,
    ...(granted && { granted }),
    ...(fromItem && { fromItem }),
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
      ...(pick(entriesSchema, row.json.entriesHigherLevel) ?? []),
    ],
  };
}

/**
 * The spells equipped items let the character cast, in inventory order, each marked granted
 * and citing its item. A spell the definition already lists stays as that entry, and one
 * several items attach lists once, citing them all. An item that waits on attunement lists
 * none until attuned. A name no row answers is left out: no definition entry holds it, so the sheet has nothing to repair.
 */
function itemSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): SheetSpell[] {
  const rows = resolveItemRows(dataDir, homebrewDb, definition.inventory);
  const attached = definition.inventory.flatMap((entry, index) => {
    const row = rows[index];
    if (!row || !entry.equipped || (row.requiresAttunement && !entry.attuned)) return [];
    const names = attachedSpellsSchema.safeParse(row.json).data ?? [];
    return names.map((name) => ({ item: row.name, name }));
  });
  const found = findSpells(
    dataDir,
    definition.edition,
    attached.map(({ name }) => name),
  );
  const known = new Set(
    definition.spells.flatMap(({ ref }) => ("homebrewId" in ref ? [] : [entryKey(ref)])),
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
    return sheetSpell({ ref, prepared: true, granted: true }, catalogFacts(row), items.join(", "));
  });
}

export function resolveCharacterSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterSpells {
  const rows = rowFacts(dataDir, homebrewDb, definition.spells);
  const spells: SheetSpell[] = definition.spells.map((entry, index) =>
    sheetSpell(entry, rows[index]),
  );
  return { spells: [...spells, ...itemSpells(dataDir, homebrewDb, definition)] };
}
