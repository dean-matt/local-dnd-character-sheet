/** Each spell school's name, keyed by upstream's one-letter code. */
export const SCHOOLS: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

/** A spell school's name from its code; a code not listed prints as itself. */
export const schoolName = (code: string): string => SCHOOLS[code] ?? code;
