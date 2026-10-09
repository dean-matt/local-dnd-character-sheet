/**
 * `data/class/class-*.json` into the Tier A class tables.
 *
 * Ten tables come from one file: the class and subclass entries, their
 * level-indexed table groups split into spell slots and every other resource,
 * the optional features each level may pick, and the features each grants.
 */
import { featureTypePool, OPTIONAL_FEATURES_FILE } from "./character-options.ts";
import { CLASS_FLUFF, fluffPools } from "./class-fluff.ts";
import {
  addClasses,
  addFeatures,
  addSubclasses,
  checkFeatureOwners,
  entriesOf,
  sidekickClasses,
  type Tables,
} from "./class-rows.ts";
import { EDITION_FILES, editions, ownFiles } from "./edition.ts";
import { markFeatureChoices } from "./feature-choices.ts";
import { isFluffPath } from "./fluff.ts";
import type { Loader, Row } from "./index.ts";
import { text } from "./json.ts";

/**
 * Every `(name, source)` this loader would write to `classes`, sidekicks
 * excluded. `spells.ts` calls this to check a spell's grantors against, since a
 * loader only ever sees its own files and cannot read what this one writes.
 */
export function classIdentities(sources: Map<string, unknown>): Set<string> {
  const known = new Set<string>();
  for (const [path, source] of sources) {
    if (!path.startsWith("data/class/")) continue;
    for (const [index, entry] of entriesOf(source, "class", path).entries()) {
      if (entry.isSidekick === true) continue;
      const context = `${path} class[${index}]`;
      known.add(`${text(entry, "name", context)}|${text(entry, "source", context)}`);
    }
  }
  return known;
}

/** Shared with `spells.ts`, which needs a class's identity but not its tables. */
export const CLASS_FILES = "data/class/class-*.json";

export const classes: Loader = {
  name: "classes",
  files: [CLASS_FILES, CLASS_FLUFF, OPTIONAL_FEATURES_FILE, ...EDITION_FILES],
  rows: (sources) => {
    const fromSource = editions(sources);
    const out: Tables = {
      classes: [],
      subclasses: [],
      class_resources: [],
      spell_slots: [],
      subclass_resources: [],
      subclass_spell_slots: [],
      class_optional_features: [],
      subclass_optional_features: [],
      class_features: [],
      subclass_features: [],
    };

    const all = ownFiles(sources).filter(([path]) => path !== OPTIONAL_FEATURES_FILE);
    const fluff = fluffPools(all);
    const files = all.filter(([path]) => !isFluffPath(path));
    const sidekicks = sidekickClasses(files);
    const pool = featureTypePool(sources, fromSource);
    const claims = new Map<Row, string>();
    for (const [path, source] of files) {
      addClasses(out, source, path, fromSource, pool, fluff.classes);
      addSubclasses(out, source, path, fromSource, pool, fluff.subclasses);
      addFeatures(out, claims, source, path, fromSource, sidekicks);
    }
    checkFeatureOwners(out, claims);
    markFeatureChoices(out.class_features, claims);
    markFeatureChoices(out.subclass_features, claims);
    return out;
  },
};
