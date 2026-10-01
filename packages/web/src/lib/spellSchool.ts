/** A spell school's name from upstream's one-letter code; a code not listed prints as itself. */
const SCHOOL: Record<string, string> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  V: "Evocation",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
};

export const schoolName = (code: string): string => SCHOOL[code] ?? code;
