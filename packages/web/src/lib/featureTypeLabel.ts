/** Upstream's names for the codes an option is picked under. */
const FEATURE_TYPE_LABEL: Record<string, string> = {
  AI: "Artificer Infusion",
  AS: "Arcane Shot",
  ED: "Elemental Discipline",
  EI: "Eldritch Invocation",
  "FS:B": "Fighting Style (Bard)",
  "FS:F": "Fighting Style (Fighter)",
  "FS:P": "Fighting Style (Paladin)",
  "FS:R": "Fighting Style (Ranger)",
  MM: "Metamagic",
  "MV:B": "Maneuver (Battle Master)",
  PB: "Pact Boon",
  RN: "Rune Knight Rune",
};

/** The name of the option type `code` stands for, or `code` itself where none is listed. */
export const featureTypeLabel = (code: string): string => FEATURE_TYPE_LABEL[code] ?? code;

/** What one option of each type is called in running text, without the label's qualifier. */
const FEATURE_TYPE_NOUN: Record<string, string> = {
  AI: "artificer infusion",
  AS: "arcane shot",
  ED: "elemental discipline",
  EI: "eldritch invocation",
  "FS:B": "fighting style",
  "FS:F": "fighting style",
  "FS:P": "fighting style",
  "FS:R": "fighting style",
  MM: "metamagic option",
  "MV:B": "maneuver",
  PB: "pact boon",
  RN: "rune",
};

/** One option of type `code` in running text — `maneuver` — or `option` where none is listed. */
export const featureTypeNoun = (code: string): string => FEATURE_TYPE_NOUN[code] ?? "option";
