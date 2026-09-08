/**
 * Parses 5etools `{@tag}` markup into tokens.
 *
 * `parseTags` is the entry point and `renderText` flattens tokens back to the plain
 * string an FTS index needs. Every token carries display text, so a renderer can fall
 * back to it without knowing the tag. No catalog lookups happen here — this package
 * depends on nothing, and resolving a `ref` belongs to a later layer.
 *
 * Upstream writes no escapes: there is no `\|` or `\{` anywhere in the corpus. A pipe
 * always separates arguments and a brace always nests.
 */

export type Token =
  | { kind: "text"; value: string }
  | { kind: "ref"; tag: string; name: string; source?: string; display: string }
  | { kind: "roll"; notation: string; display: string; rollable: boolean }
  | { kind: "style"; style: "italic" | "bold"; children: Token[] };

type RefToken = Extract<Token, { kind: "ref" }>;

/**
 * Which argument holds what, per tag. The position of the display argument is not
 * uniform: `{@spell a|b|c}` displays `c`, `{@dice a|b}` displays `b`, and
 * `{@filter a|b|c}` displays `a`.
 */
type Spec =
  | { kind: "ref"; source: number; display: number }
  | { kind: "roll"; notation: number; display: number }
  | { kind: "text"; display: number }
  | { kind: "style"; style: "italic" | "bold" }
  | { kind: "wrapper" }
  | { kind: "computed"; render: (args: string[]) => Token };

const text = (value: string): Token => ({ kind: "text", value });

/** An empty argument means "default", not an empty string. */
function arg(args: string[], index: number): string | undefined {
  const value = args[index];
  return value === undefined || value === "" ? undefined : value;
}

/** Flattens nesting inside an argument, because a display is a string and not a tree. */
function plain(value: string): string {
  return value.includes("{@") ? renderText(parseTags(value)) : value;
}

/** Falls back to the first argument, which is the name or notation for every tag. */
function display(args: string[], index: number): string {
  return plain(arg(args, index) ?? arg(args, 0) ?? "");
}

/**
 * Conservative, because `@dnd/dice` is the authority on notation and this package
 * depends on nothing. A false negative costs a click-to-roll button; a false positive
 * throws inside `@dnd/dice`, which the roll layer has to handle regardless.
 */
const PLAIN_NOTATION = /^\d*\s*d\s*\d+(?:\s*k\s*[hl]\s*\d+)?(?:\s*[+-]\s*\d+)?$/i;

const ABILITIES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const ATTACK_RANGE: Record<string, string> = { m: "Melee", r: "Ranged", a: "Area" };
const ATTACK_MEANS: Record<string, string> = { w: "Weapon", s: "Spell" };

/**
 * `{@atk mw,rw}` reads "Melee or Ranged Weapon Attack:" rather than repeating the
 * means, so a means shared by every code is factored out of the list.
 */
function attack(args: string[], suffix: string): Token {
  const raw = arg(args, 0) ?? "";
  const codes = raw
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code !== "");

  const parts: { range: string; means: string }[] = [];
  for (const code of codes) {
    const range = ATTACK_RANGE[code.slice(0, 1)];
    const means = code.length > 1 ? ATTACK_MEANS[code.slice(1)] : "";
    if (range === undefined || means === undefined) return text(raw);
    parts.push({ range, means });
  }

  const first = parts[0];
  if (first === undefined) return text(raw);

  const ranges = parts.map((part) => part.range).join(" or ");
  const phrase = parts.every((part) => part.means === first.means)
    ? `${ranges}${first.means === "" ? "" : ` ${first.means}`}`
    : parts.map((part) => `${part.range} ${part.means}`.trim()).join(" or ");
  return text(`${phrase}${suffix}`);
}

/** `{@hit 5}` is the d20 attack roll, so the notation is synthesized rather than read. */
function attackRoll(args: string[]): Token {
  const bonus = arg(args, 0) ?? "";
  const signed = /^[+-]/.test(bonus) ? bonus : `+${bonus}`;
  const notation = `1d20${signed}`;
  return {
    kind: "roll",
    notation,
    display: arg(args, 1) ?? signed,
    rollable: PLAIN_NOTATION.test(notation),
  };
}

/** A bare `{@recharge}` means a 6 only; a number is the low end of the range. */
function recharge(args: string[]): Token {
  const low = arg(args, 0) ?? "6";
  return text(low === "6" ? "(Recharge 6)" : `(Recharge ${low}–6)`);
}

/** `name|source|display`, the shape of every tag that points at a catalog entity. */
const REF_TAGS = [
  "action",
  "background",
  "card",
  "class",
  "condition",
  "creature",
  "deck",
  "deity",
  "disease",
  "facility",
  "feat",
  "hazard",
  "item",
  "itemMastery",
  "itemProperty",
  "language",
  "optfeature",
  "race",
  "recipe",
  "reward",
  "sense",
  "skill",
  "spell",
  "status",
  "subclass",
  "table",
  "variantrule",
  "vehicle",
];

/**
 * `display|target|…`. These point outside the catalog — a book page, a filtered list,
 * an external URL — so the display text is all there is to render.
 */
const OUTBOUND_TAGS = [
  "5etools",
  "5etoolsImg",
  "adventure",
  "area",
  "book",
  "color",
  "comic",
  "filter",
  "font",
  "link",
];

function buildSpecs(): Map<string, Spec> {
  const specs = new Map<string, Spec>();

  for (const tag of REF_TAGS) specs.set(tag, { kind: "ref", source: 1, display: 2 });
  for (const tag of OUTBOUND_TAGS) specs.set(tag, { kind: "text", display: 0 });

  specs.set("classFeature", { kind: "ref", source: 4, display: 5 });
  specs.set("subclassFeature", { kind: "ref", source: 6, display: 7 });
  specs.set("quickref", { kind: "text", display: 4 });

  specs.set("dice", { kind: "roll", notation: 0, display: 1 });
  specs.set("damage", { kind: "roll", notation: 0, display: 1 });
  specs.set("scaledamage", { kind: "roll", notation: 2, display: 2 });

  specs.set("i", { kind: "style", style: "italic" });
  specs.set("b", { kind: "style", style: "bold" });
  specs.set("note", { kind: "wrapper" });

  const computed: Record<string, (args: string[]) => Token> = {
    // A save DC is a target number, not something to roll.
    dc: (args) => text(arg(args, 1) ?? `DC ${arg(args, 0) ?? ""}`),
    dcYourSpellSave: (args) => text(arg(args, 0) ?? "your spell save DC"),
    hit: attackRoll,
    hitYourSpellAttack: (args) => text(arg(args, 0) ?? "your spell attack modifier"),
    h: () => text("Hit: "),
    atk: (args) => attack(args, " Attack:"),
    atkr: (args) => attack(args, " Attack Roll:"),
    recharge,
    chance: (args) => text(arg(args, 1) ?? `${arg(args, 0) ?? ""} percent`),
    actSave: (args) => {
      const ability = arg(args, 0) ?? "";
      return text(`${ABILITIES[ability.toLowerCase()] ?? ability} Saving Throw:`);
    },
    actSaveFail: () => text("Failure:"),
    actSaveSuccess: () => text("Success:"),
  };
  for (const [tag, render] of Object.entries(computed)) {
    specs.set(tag, { kind: "computed", render });
  }

  return specs;
}

const SPECS = buildSpecs();

/**
 * A computed display can still hold nesting: `{@hit +3|{@hit 3} to hit}` puts a tag in
 * the display argument. Flattening here covers every computed tag rather than each one
 * remembering to do it.
 */
function flatten(token: Token): Token {
  switch (token.kind) {
    case "text":
      return token.value.includes("{@") ? text(plain(token.value)) : token;
    case "roll":
      return token.display.includes("{@") ? { ...token, display: plain(token.display) } : token;
    default:
      return token;
  }
}

function matchingBrace(input: string, open: number): number {
  let depth = 0;
  for (let index = open; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Splits on pipes outside any nested tag, so `{@i a|b}` inside an argument survives. */
function splitArgs(body: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of body) {
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (char === "|" && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  args.push(current);
  return args;
}

/** Turns the inside of one `{@…}` into tokens. An unknown tag becomes its display text. */
function expand(inner: string): Token[] {
  const boundary = inner.search(/[\s|]/);
  const tag = boundary === -1 ? inner : inner.slice(0, boundary);
  const rest =
    boundary === -1 ? "" : inner.slice(inner[boundary] === "|" ? boundary : boundary + 1);
  const args = rest === "" ? [] : splitArgs(rest);

  const spec = SPECS.get(tag);
  if (spec === undefined) return [text(display(args, 0))];

  switch (spec.kind) {
    case "ref": {
      const token: RefToken = {
        kind: "ref",
        tag,
        name: plain(arg(args, 0) ?? ""),
        display: display(args, spec.display),
      };
      const source = arg(args, spec.source);
      if (source !== undefined) token.source = source;
      return [token];
    }
    case "roll": {
      const notation = arg(args, spec.notation) ?? "";
      return [
        {
          kind: "roll",
          notation,
          display: display(args, spec.display),
          rollable: PLAIN_NOTATION.test(notation),
        },
      ];
    }
    case "text":
      return [text(display(args, spec.display))];
    case "style":
      return [{ kind: "style", style: spec.style, children: parseTags(rest) }];
    case "wrapper":
      return parseTags(rest);
    case "computed":
      return [flatten(spec.render(args))];
  }
}

/**
 * Tokenizes `input`. Never throws: an unknown tag degrades to its display text and
 * unbalanced markup stays literal, because upstream adds tags and existing characters
 * must keep rendering when it does.
 */
export function parseTags(input: string): Token[] {
  const tokens: Token[] = [];
  let literal = "";
  let index = 0;

  const flush = (): void => {
    if (literal !== "") {
      tokens.push(text(literal));
      literal = "";
    }
  };

  while (index < input.length) {
    if (!input.startsWith("{@", index)) {
      literal += input[index] ?? "";
      index += 1;
      continue;
    }
    const close = matchingBrace(input, index);
    if (close === -1) {
      literal += input.slice(index);
      break;
    }
    flush();
    tokens.push(...expand(input.slice(index + 2, close)));
    index = close + 1;
  }

  flush();
  return tokens;
}

/** Flattens tokens to plain text, which is what the FTS index stores. */
export function renderText(tokens: Token[]): string {
  let out = "";
  for (const token of tokens) {
    switch (token.kind) {
      case "text":
        out += token.value;
        break;
      case "style":
        out += renderText(token.children);
        break;
      default:
        out += token.display;
    }
  }
  return out;
}
