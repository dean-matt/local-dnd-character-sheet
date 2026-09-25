/**
 * The facts a caster checks before casting, written the way a spell's header prints them:
 * `1 bonus action`, `Self (15-foot cone)`, `V, S, M (a pinch of salt)`, `Up to 1 minute`.
 * Each takes upstream's own shape and returns `undefined` for a fact the spell left out,
 * so the sheet shows a dash rather than invent one. A unit or type not listed prints as
 * upstream spells it rather than failing.
 */
import type { SheetSpell } from "@dnd/catalog";

type Resolved = Extract<SheetSpell, { resolved: true }>;

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

const UNIT: Record<string, [singular: string, plural: string]> = {
  action: ["action", "actions"],
  bonus: ["bonus action", "bonus actions"],
  reaction: ["reaction", "reactions"],
  round: ["round", "rounds"],
  minute: ["minute", "minutes"],
  hour: ["hour", "hours"],
  day: ["day", "days"],
  feet: ["foot", "feet"],
  miles: ["mile", "miles"],
};

const count = (amount: number, unit: string): string => {
  const [singular, plural] = UNIT[unit] ?? [unit, unit];
  return `${amount} ${amount === 1 ? singular : plural}`;
};

/** A reaction keeps its trigger, the part a caster checks first; it may carry `{@tag}` markup. */
export function castingTime(time: Resolved["time"]): string | undefined {
  return time
    ?.map((span) => {
      const length = count(span.number, span.unit);
      return span.condition ? `${length}, ${span.condition}` : length;
    })
    .join(" or ");
}

const NAMED_DISTANCE: Record<string, string> = {
  self: "Self",
  touch: "Touch",
  sight: "Sight",
  unlimited: "Unlimited",
};

export function spellRange(range: Resolved["range"]): string | undefined {
  if (!range) return undefined;
  if (range.type === "special") return "Special";
  const { distance } = range;
  if (!distance) return undefined;
  const named = NAMED_DISTANCE[distance.type];
  if (named) return named;
  if (distance.amount === undefined) return distance.type;
  if (range.type === "point") return count(distance.amount, distance.type);
  // An area is centered on the caster: `Self (15-foot cone)`.
  const [singular] = UNIT[distance.type] ?? [distance.type];
  return `Self (${distance.amount}-${singular} ${range.type})`;
}

export function spellComponents(components: Resolved["components"]): string | undefined {
  if (!components) return undefined;
  const { v, s, m, r } = components;
  const material =
    m === undefined || m === false
      ? undefined
      : m === true
        ? "M"
        : `M (${typeof m === "string" ? m : m.text})`;
  const parts = [v && "V", s && "S", material, r && "R"].filter(Boolean);
  return parts.length === 0 ? undefined : parts.join(", ");
}

const ENDS: Record<string, string> = {
  dispel: "dispelled",
  trigger: "triggered",
  discharge: "discharged",
};

type Span = NonNullable<Resolved["duration"]>[number];

function durationSpan(span: Span): string {
  if (span.type === "instant") return "Instantaneous";
  if (span.type === "special") return "Special";
  if (span.type === "permanent") {
    return span.ends
      ? `Until ${span.ends.map((end) => ENDS[end] ?? end).join(" or ")}`
      : "Permanent";
  }
  const { duration } = span;
  if (!duration || duration.amount === undefined) return span.type;
  const length = count(duration.amount, duration.type);
  return span.concentration || duration.upTo ? `Up to ${length}` : length;
}

/** Concentration is its own mark on the sheet, so the duration says only how long. */
export function spellDuration(duration: Resolved["duration"]): string | undefined {
  return duration?.map(durationSpan).join(" or ");
}
