/**
 * Tier C: every entity with no bespoke table of its own, into `entities`.
 *
 * A row is its identity, the whole entry as `json`, and `rendered_text` — the entry's
 * own strings with `{@tag}` markup reduced to the words it displays, which is what
 * `entities_fts` searches. No column beyond identity, because nothing queries one. A
 * type promoted to Tier A leaves by deleting its line from `KINDS`, and a file declared
 * with no kinds contributes nothing but its entries to the `_copy` pool.
 *
 * What the rest of `vendor/5etools/data/` is and why it stays out. The `foundry` and
 * `index` files and everything under `generated/` restate files already loaded for a
 * virtual tabletop, a picker or a search page, so declaring one makes a real parent
 * ambiguous and `copy.ts` refuses the build. `encounterbuilder.json`, `life.json`,
 * `loot.json`, `makebrew-creature.json`, `makecards.json`, `monsterfeatures.json` and
 * `msbcr.json` are tables a tool rolls on rather than entries anything references, and
 * `monsterfeatures` carries no source at all. `fluff-*.json` is lore keyed to an entry
 * that already has a row, so a row of its own answers every search twice; folding it
 * into the entry it describes is how it belongs here, and `{@creatureFluff}` is 2 tags
 * in the whole corpus.
 */
import { parseTags, renderText } from "@dnd/tags";
import { EDITION_FILES, type Edition, editionOf, editions, ownFiles } from "./edition.ts";
import type { Loader, Row } from "./index.ts";
import { type Entry, entriesOf, kindedRows, text } from "./json.ts";

/** The array keys each file contributes, which are the types its rows carry. */
const KINDS: Record<string, string[]> = {
  "data/bastions.json": ["facility"],
  "data/charcreationoptions.json": ["charoption"],
  "data/cultsboons.json": ["cult", "boon"],
  "data/decks.json": ["deck", "card"],
  "data/encounters.json": ["encounter"],
  "data/homecrafts.json": ["crochetPattern"],
  "data/names.json": ["name"],
  "data/objects.json": ["object"],
  "data/recipes.json": ["recipe"],
  "data/rewards.json": ["reward"],
  "data/trapshazards.json": ["trap", "hazard"],
  "data/vehicles.json": ["vehicle", "vehicleUpgrade"],
};

/**
 * The bestiary is its own loader because its `_copy` pool is: 1,060 blocks name a parent
 * in another bestiary file, and `_copy._templates` names a `monsterTemplate`, which is
 * why `template.json` is declared without contributing rows.
 */
const BESTIARY_KINDS: Record<string, string[]> = {
  "data/bestiary/bestiary-*.json": ["monster"],
  "data/bestiary/legendarygroups.json": ["legendaryGroup"],
  "data/bestiary/template.json": [],
};

/**
 * An adventure and a book are one row each: the index entry, which is where the name and
 * the source are, with the volume's whole prose as the text to search. The body file
 * carries neither, and its structure is not modelled — a search returns the volume.
 */
const VOLUMES = [
  { type: "adventure", bodies: "data/adventure/adventure-" },
  { type: "book", bodies: "data/book/book-" },
];

/** The field holding the identity a type needs beyond `(name, source)`, as a pantheon. */
const QUALIFIED_BY: Record<string, string> = { card: "set" };

/**
 * Keys whose strings are a pointer rather than words: the books an entry was printed in,
 * the entries it names elsewhere, and the asset it renders with. Every one of them
 * spells a catalog key — `scimitar|phb` — or a file path, so indexing them answers a
 * search for `phb` with every monster carrying a Player's Handbook weapon.
 *
 * The names themselves still reach the index wherever the entry writes them as prose: a
 * goblin's `{@item scimitar|phb}` renders to `scimitar` in the line that attacks with it.
 */
const NOT_TEXT = new Set([
  "source",
  "otherSources",
  "additionalSources",
  "referenceSources",
  "reprintedAs",
  "attachedItems",
  "gear",
  "summonedBySpell",
  "seeAlsoItem",
  "seeAlsoCreature",
  "chargesItem",
  "soundClip",
  "href",
  "hrefThumbnail",
  "path",
]);

function collect(node: unknown, into: string[]): string[] {
  if (typeof node === "string") into.push(node);
  else if (Array.isArray(node)) for (const child of node) collect(child, into);
  else if (node !== null && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      if (!NOT_TEXT.has(key)) collect(child, into);
    }
  }
  return into;
}

/**
 * Everything the entry says, as one searchable string.
 *
 * Every string it holds but the pointers, rather than the prose fields alone, because a
 * list of prose fields that misses one loses words with nothing raised. What is left is
 * words a reader would recognise, plus the structural values beside them: a `type` of
 * `entries` is indexed because the same key holds a creature's `humanoid`.
 */
function rendered(node: unknown): string {
  return collect(node, [])
    .map((value) => renderText(parseTags(value)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRow(
  entry: Entry,
  type: string,
  context: string,
  fromSource: (source: string) => Edition,
): Row {
  const source = text(entry, "source", context);
  const qualifier = QUALIFIED_BY[type];
  return {
    type,
    name: text(entry, "name", context),
    source,
    qualifier: qualifier === undefined ? "" : text(entry, qualifier, context),
    edition: editionOf(entry, source, fromSource),
    json: JSON.stringify(entry),
    rendered_text: rendered(entry),
  };
}

/**
 * Whether a declared path or glob covers this source. `readSources` expands the glob and
 * keeps no record of which pattern matched, so the kinds are matched back to it.
 *
 * One `*`, matching within a directory, which is every declaration above. A pattern with
 * a second one matches nothing here while `readSources` still reads its files, so they
 * reach `kindedRows` belonging to no kind and the build stops there.
 */
function matches(pattern: string, path: string): boolean {
  const star = pattern.indexOf("*");
  if (star === -1) return pattern === path;
  const head = pattern.slice(0, star);
  const tail = pattern.slice(star + 1);
  return (
    path.length >= head.length + tail.length &&
    path.startsWith(head) &&
    path.endsWith(tail) &&
    !path.slice(head.length, path.length - tail.length).includes("/")
  );
}

/** The kinds every source carries. A source the declaration does not match keeps none,
 * so `kindedRows` refuses it rather than writing a short table. */
function expand(kinds: Record<string, string[]>, paths: string[]): Record<string, string[]> {
  return Object.fromEntries(
    paths.flatMap((path) => {
      const patterns = Object.keys(kinds).filter((candidate) => matches(candidate, path));
      // Two patterns over one file is a declaration that does not say which kinds the
      // file carries. Taking the first would make their order load-bearing and silent.
      if (patterns.length > 1) {
        throw new Error(
          `${path} is declared by ${patterns.length} patterns: ${patterns.join(", ")}`,
        );
      }
      const only = patterns[0];
      return only === undefined ? [] : [[path, kinds[only] as string[]]];
    }),
  );
}

function loader(name: string, kinds: Record<string, string[]>): Loader {
  return {
    name,
    files: [...Object.keys(kinds), ...EDITION_FILES],
    rows: (sources) => {
      const fromSource = editions(sources);
      const files = ownFiles(sources);
      return {
        entities: kindedRows(
          files,
          expand(
            kinds,
            files.map(([path]) => path),
          ),
          (entry, kind, context) => toRow(entry, kind, context, fromSource),
        ),
      };
    },
  };
}

function volume({ type, bodies }: { type: string; bodies: string }): Loader {
  const index = `data/${type}s.json`;
  return {
    name: `entities-${type}s`,
    // `index` is one of EDITION_FILES today. Declared anyway, because this loader reads
    // it for its rows and would otherwise break on the day edition derivation stops.
    files: [index, ...EDITION_FILES, `${bodies}*.json`],
    rows: (sources) => {
      const fromSource = editions(sources);
      return {
        entities: entriesOf(sources.get(index), type, index).map((entry, at) => {
          const context = `${index} ${type}[${at}]`;
          const id = text(entry, "id", context);
          const path = `${bodies}${id.toLowerCase()}.json`;
          const body = sources.get(path);
          if (body === undefined) throw new Error(`${context}: ${id} has no body at ${path}`);
          const source = text(entry, "source", context);
          return {
            type,
            name: text(entry, "name", context),
            source,
            qualifier: "",
            edition: editionOf(entry, source, fromSource),
            json: JSON.stringify(entry),
            rendered_text: rendered([entry, body]),
          };
        }),
      };
    },
  };
}

export const entityLoaders: Loader[] = [
  loader("entities", KINDS),
  loader("entities-bestiary", BESTIARY_KINDS),
  ...VOLUMES.map(volume),
];
