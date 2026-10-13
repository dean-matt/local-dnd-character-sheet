/**
 * A class's and a subclass's detail, built from the fields a 5etools class row carries in
 * place of `entries`: hit die, saving throws, starting proficiencies and equipment,
 * multiclassing, and a level table whose features each link to their own entry. A field
 * the row lacks leaves its line or section out.
 */
import { ABILITY_LABEL } from "@dnd/rules";
import { type Entries, rowEntries } from "./entry.ts";
import { capitalized, isRecord, line, list, ordinal, titled } from "./entry-text.ts";
import { multiclassEntrySchema, multiclassPrerequisiteSchema } from "./multiclass.ts";
import { classSkillChoiceSchema } from "./skill-choice.ts";

type Json = Record<string, unknown>;

const joined = (values: string[]) =>
  values.length > 0 ? capitalized(values.join(", ")) : undefined;

const section = (name: string, entries: Entries): Entries =>
  entries.length > 0 ? [{ type: "entries", name, entries }] : [];

/** Upstream writes an armor or weapon category bare, as `light` or `martial`. */
const CATEGORIES: Record<string, string> = {
  light: "light armor",
  medium: "medium armor",
  heavy: "heavy armor",
  shield: "shields",
  simple: "simple weapons",
  martial: "martial weapons",
};

/** A proficiency string as printed, or an object's `full` wording, or its name marked optional. */
function proficiency(value: unknown): string[] {
  if (typeof value === "string") return [CATEGORIES[value] ?? value];
  if (!isRecord(value) || typeof value.proficiency !== "string") return [];
  if (typeof value.full === "string") return [value.full];
  const name = CATEGORIES[value.proficiency] ?? value.proficiency;
  return [value.optional === true ? `${name} (optional)` : name];
}

/** The armor, weapons, tools and skills a row's `startingProficiencies` lists. */
function proficiencyLines(json: Json): Entries {
  const profs = isRecord(json.startingProficiencies) ? json.startingProficiencies : {};
  const skills = classSkillChoiceSchema.parse(json);
  const skillLine =
    skills &&
    (skills.from
      ? `Choose ${skills.count} from ${skills.from.map(titled).join(", ")}`
      : `Choose any ${skills.count}`);
  return [
    ...line("Armor", joined(list(profs.armor).flatMap(proficiency))),
    ...line("Weapons", joined(list(profs.weapons).flatMap(proficiency))),
    ...line("Tools", joined(list(profs.tools).flatMap(proficiency))),
    ...line("Skills", skillLine),
  ];
}

/**
 * A `classic` row prints its choices under `default`, a `one` row under `entries`. A row
 * marked `additionalFromBackground` says so first, or its list reads as all a character gets.
 */
function startingEquipment(json: Json): Entries {
  const equipment = isRecord(json.startingEquipment) ? json.startingEquipment : {};
  const lines = list(equipment.default).filter((item) => typeof item === "string");
  const gold = equipment.goldAlternative;
  const printed = [
    ...rowEntries(equipment),
    ...(lines.length > 0 ? [{ type: "list", items: lines }] : []),
    ...(typeof gold === "string"
      ? [`Alternatively, start with ${gold} gp to buy your own equipment.`]
      : []),
  ];
  const lead =
    printed.length > 0 && equipment.additionalFromBackground === true
      ? ["You start with this equipment in addition to what your background grants."]
      : [];
  return [...lead, ...printed];
}

function multiclassing(json: Json): Entries {
  const prerequisite = multiclassPrerequisiteSchema
    .parse(json)
    .map((option) =>
      Object.entries(option)
        .map(
          ([ability, score]) => `${ABILITY_LABEL[ability as keyof typeof ABILITY_LABEL]} ${score}`,
        )
        .join(" and "),
    )
    .join(" or ");
  return [
    ...line("Prerequisite", prerequisite || undefined),
    ...proficiencyLines(multiclassEntrySchema.parse(json)),
  ];
}

/**
 * A feature reference as its level and its tag, `undefined` where its level is no class
 * level. `levelAt` is the reference's field holding the level; the feature's source
 * follows it, and a `tableDisplayName` displays after that.
 */
function featureTag(feature: unknown, tag: string, levelAt: number) {
  const entry = isRecord(feature) ? feature : { classFeature: feature };
  if (typeof entry.classFeature !== "string") return undefined;
  const fields = entry.classFeature.split("|").slice(0, levelAt + 2);
  const level = Number(fields[levelAt]);
  if (!Number.isInteger(level) || level < 1 || level > 20) return undefined;
  if (typeof entry.tableDisplayName === "string") {
    fields.length = levelAt + 2;
    fields.push(entry.tableDisplayName);
  }
  return { level, text: `{@${tag} ${fields.join("|")}}` };
}

/** One row per level that gains a feature, each a tag the renderer links to its entry. */
function featureTable(features: unknown, tag: string, levelAt: number): Entries {
  const byLevel = new Map<number, string[]>();
  for (const feature of list(features)) {
    const found = featureTag(feature, tag, levelAt);
    if (found) byLevel.set(found.level, [...(byLevel.get(found.level) ?? []), found.text]);
  }
  const rows = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, texts]) => [ordinal(`${level}`), texts.join(", ")]);
  return section(
    "Features",
    rows.length > 0 ? [{ type: "table", colLabels: ["Level", "Features"], rows }] : [],
  );
}

export function classEntries(json: Json): Entries {
  const hd = isRecord(json.hd) ? json.hd.faces : undefined;
  const saves = list(json.proficiency).flatMap((ability) =>
    typeof ability === "string" && ability in ABILITY_LABEL
      ? [ABILITY_LABEL[ability as keyof typeof ABILITY_LABEL]]
      : [],
  );
  return [
    ...line("Hit Die", typeof hd === "number" ? `d${hd}` : undefined),
    ...line("Saving Throws", saves.join(", ") || undefined),
    ...proficiencyLines(json),
    ...section("Starting Equipment", startingEquipment(json)),
    ...section("Multiclassing", multiclassing(json)),
    ...rowEntries(json),
    ...featureTable(json.classFeatures, "classFeature", 3),
  ];
}

/** A subclass reference names its subclass between the class and the level. */
export function subclassEntries(json: Json): Entries {
  return [...rowEntries(json), ...featureTable(json.subclassFeatures, "subclassFeature", 5)];
}
