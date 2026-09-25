/**
 * Resolves the spells one definition lists, reading `content.db` for a catalog reference
 * and `homebrew.db` for a homebrew one. A reference nothing answers stays in the list,
 * marked unresolved, for the reason `features.ts` gives.
 */
import {
  type CharacterSpells,
  entriesSchema,
  type SheetSpell,
  spellCastingFactsSchema,
} from "@dnd/catalog";
import { type CharacterDefinition, displayName } from "@dnd/character";
import type { ZodType } from "zod";
import { getSpell } from "./content.ts";
import { getHomebrewSpell, type HomebrewDb } from "./homebrew.ts";

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

/** Each fact parsed alone, so one malformed field leaves the others standing. */
function castingFacts(json: Record<string, unknown>) {
  const { shape } = spellCastingFactsSchema;
  return {
    time: pick(shape.time, json.time),
    range: pick(shape.range, json.range),
    components: pick(shape.components, json.components),
    duration: pick(shape.duration, json.duration),
  };
}

function rowFacts(dataDir: string, homebrewDb: HomebrewDb, entry: SpellEntry) {
  const { ref } = entry;
  if ("homebrewId" in ref) {
    const row = getHomebrewSpell(homebrewDb, ref.homebrewId);
    return row && { ...row, json: row.json as Record<string, unknown> };
  }
  const row = getSpell(dataDir, ref.name, ref.source);
  return (
    row && {
      ...row,
      concentration: row.concentration === 1,
      ritual: row.ritual === 1,
      json: JSON.parse(row.json) as Record<string, unknown>,
    }
  );
}

function sheetSpell(entry: SpellEntry, row: (SpellRowFacts & { name: string }) | undefined) {
  const { ref, prepared, origin } = entry;
  const fields = {
    name: row?.name ?? displayName(ref),
    ...("homebrewId" in ref ? {} : { source: ref.source }),
    prepared,
    ...(origin && { origin }),
  };
  if (!row) return { resolved: false as const, ...fields };
  return {
    resolved: true as const,
    ...fields,
    level: row.level,
    school: row.school,
    concentration: row.concentration,
    ritual: row.ritual,
    ...castingFacts(row.json),
    entries: pick(entriesSchema, row.json.entries) ?? [],
  };
}

export function resolveCharacterSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterSpells {
  const spells: SheetSpell[] = definition.spells.map((entry) =>
    sheetSpell(entry, rowFacts(dataDir, homebrewDb, entry)),
  );
  return { spells };
}
