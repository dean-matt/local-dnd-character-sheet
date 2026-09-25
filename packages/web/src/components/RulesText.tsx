/**
 * Renders 5etools rules text: `RulesText` turns one markup string into its tokens,
 * and `RulesEntries` walks the recursive `entries` structure around it — prose,
 * lists, tables and named subsections — down to the strings `RulesText` renders.
 *
 * The outermost `RulesText` or `RulesEntries` is a block: it resolves every reference
 * inside it in one request, and a reference the catalog answers opens a popover of
 * that row's text. One it does not answer — or has not yet — renders as its display
 * text alone, its fields carried on the span as data attributes, and so does a roll
 * until a later tier makes it clickable.
 */
import type { Entries, RefQuery, ResolvedRef } from "@dnd/catalog";
import { parseTags, renderText, type Token } from "@dnd/tags";
import { createContext, type ElementType, type ReactNode, useContext, useMemo } from "react";
import { Link } from "react-router";
import { useResolvedRefs } from "../hooks/useResolvedRefs.ts";
import { Popover } from "./Popover.tsx";

type StyleToken = Extract<Token, { kind: "style" }>;
type RefToken = Extract<Token, { kind: "ref" }>;
type Emphasis = StyleToken["style"];
type EntryNode = Exclude<Entries[number], string>;

const STYLE_ELEMENTS: Record<Emphasis, { as: ElementType; className?: string }> = {
  bold: { as: "strong" },
  italic: { as: "em" },
  underline: { as: "u" },
  underlineDouble: { as: "u", className: "decoration-double" },
  strike: { as: "s" },
  strikeDouble: { as: "s", className: "decoration-double" },
  highlight: { as: "mark" },
  superscript: { as: "sup" },
  subscript: { as: "sub" },
  keyboard: { as: "kbd" },
  code: { as: "code" },
};

function StyleSpan({ token, keyPrefix }: { token: StyleToken; keyPrefix: string }) {
  const { as: Element, className } = STYLE_ELEMENTS[token.style];
  return <Element className={className}>{renderTokens(token.children, keyPrefix)}</Element>;
}

function renderToken(token: Token, key: string): ReactNode {
  switch (token.kind) {
    case "text":
      return token.value;
    case "ref":
      return <Ref key={key} token={token} />;
    case "roll":
      return (
        <span key={key} data-notation={token.notation} data-rollable={token.rollable}>
          {token.display}
        </span>
      );
    case "style":
      return <StyleSpan key={key} token={token} keyPrefix={key} />;
  }
}

function renderTokens(tokens: Token[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, index) => renderToken(token, `${keyPrefix}-${index}`));
}

const refKey = (ref: RefQuery) => JSON.stringify([ref.tag, ref.name, ref.source ?? null]);

/** `null` outside a block. Inside one, the rows its references have resolved to so far. */
const ResolvedRefs = createContext<ReadonlyMap<string, ResolvedRef> | null>(null);

function collectRefs(tokens: Token[], into: Map<string, RefQuery>) {
  for (const token of tokens) {
    if (token.kind === "style") collectRefs(token.children, into);
    if (token.kind !== "ref") continue;
    const ref: RefQuery = { tag: token.tag, name: token.name };
    if (token.source !== undefined) ref.source = token.source;
    into.set(refKey(ref), ref);
  }
}

/** Every string anywhere in `content`, a superset of what renders: a `type` parses to no ref. */
function refsIn(content: unknown, into = new Map<string, RefQuery>()): Map<string, RefQuery> {
  if (typeof content === "string") collectRefs(parseTags(content), into);
  else if (Array.isArray(content)) for (const item of content) refsIn(item, into);
  else if (isRecord(content)) for (const value of Object.values(content)) refsIn(value, into);
  return into;
}

function ResolveBlock({ content, children }: { content: unknown; children: ReactNode }) {
  const refs = useMemo(() => [...refsIn(content).values()], [content]);
  const { data } = useResolvedRefs(refs);
  const resolved = useMemo(
    () =>
      new Map(
        refs.flatMap((ref, index) => {
          const row = data?.[index];
          return row ? [[refKey(ref), row] as const] : [];
        }),
      ),
    [refs, data],
  );
  return <ResolvedRefs value={resolved}>{children}</ResolvedRefs>;
}

/** Resolves `content`'s references unless a block around it already does. */
function Block({ content, children }: { content: unknown; children: ReactNode }) {
  const outer = useContext(ResolvedRefs);
  return outer === null ? <ResolveBlock content={content}>{children}</ResolveBlock> : children;
}

/**
 * A row's prose as plain paragraphs: a popover sits inside the sentence that cites it,
 * where a block element is invalid markup, and a link inside it would resolve a block of
 * its own. A table is left to the row's own page.
 */
function paragraphs(entries: unknown, into: string[] = []): string[] {
  if (typeof entries === "string") into.push(renderText(parseTags(entries)));
  else if (Array.isArray(entries)) for (const entry of entries) paragraphs(entry, into);
  else if (isRecord(entries)) {
    for (const key of ["name", "entry", "entries", "items"]) paragraphs(entries[key], into);
  }
  return into;
}

function Ref({ token }: { token: RefToken }) {
  const row = useContext(ResolvedRefs)?.get(
    refKey({ tag: token.tag, name: token.name, source: token.source }),
  );
  const prose = row === undefined ? [] : paragraphs(row.entries);
  // A row with no prose and no page — every monster, whose stat block is not `entries` —
  // would open onto its name alone, so it stays text.
  if (row === undefined || (prose.length === 0 && row.path === undefined)) {
    return (
      <span data-tag={token.tag} data-name={token.name} data-source={token.source}>
        {token.display}
      </span>
    );
  }
  return (
    <Popover trigger={token.display} label={`${row.name} (${row.source})`}>
      <span className="block font-semibold">
        {row.name} <span className="font-normal text-muted">{row.source}</span>
      </span>
      {prose.map((text, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a catalog row's prose never reorders.
        <span key={index} className="mt-1 block">
          {text}
        </span>
      ))}
      {row.path && (
        <Link to={`/catalog${row.path}`} className="mt-1 block underline">
          Open {row.name}
        </Link>
      )}
    </Popover>
  );
}

/** One string of upstream `{@tag}` markup, rendered as the elements its tokens mean. */
export function RulesText({ text }: { text: string }) {
  return <Block content={text}>{renderTokens(parseTags(text), "t")}</Block>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isEntries(value: unknown): value is Entries {
  return Array.isArray(value);
}

/**
 * The level a named subsection's heading takes, one deeper for each section around it.
 * 4 sits under the `h3` a sheet section opens with.
 */
const HeadingLevel = createContext(4);

const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function Section({ entry }: { entry: EntryNode }) {
  const level = useContext(HeadingLevel);
  const Heading = HEADINGS[level - 1] ?? "h6";
  const name = str(entry.name);
  const children = isEntries(entry.entries) ? entry.entries : [];
  return (
    <section className="flex flex-col gap-2">
      {name && <Heading className="font-semibold">{name}</Heading>}
      <HeadingLevel value={name ? level + 1 : level}>
        <RulesEntries entries={children} />
      </HeadingLevel>
    </section>
  );
}

function renderListItem(item: unknown, keyPrefix: string): ReactNode {
  if (typeof item === "string") return <RulesText text={item} />;
  if (!isRecord(item)) return null;
  const name = str(item.name);
  const single = str(item.entry);
  // Neither the item leaf's own fields: this is a nested structural node — a
  // list or a table sitting where an item usually does — so the general
  // dispatch renders it rather than the fixed label-and-body shape below.
  if (name === undefined && single === undefined) {
    return renderEntry(item as EntryNode, keyPrefix);
  }
  const nested = isEntries(item.entries) ? item.entries : undefined;
  return (
    <>
      {name && <strong className="mr-1">{name}</strong>}
      {single && <RulesText text={single} />}
      {nested && <RulesEntries entries={nested} />}
    </>
  );
}

function renderList(entry: EntryNode, keyPrefix: string): ReactNode {
  const items = Array.isArray(entry.items) ? entry.items : [];
  return (
    <ul key={keyPrefix} className="list-disc pl-5">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a catalog row's items never reorder.
        <li key={`${keyPrefix}-${index}`}>{renderListItem(item, `${keyPrefix}-${index}`)}</li>
      ))}
    </ul>
  );
}

/**
 * `{ exact }` or `{ min, max }`, `pad` widening a single digit to two — a rollable
 * table's numeric column, `renderdemo.json`'s own grammar for one.
 */
function rollLabel(roll: unknown): string | undefined {
  if (!isRecord(roll)) return undefined;
  const pad = (value: number) => (roll.pad === true ? String(value).padStart(2, "0") : `${value}`);
  if (typeof roll.exact === "number") return pad(roll.exact);
  if (typeof roll.min === "number" && typeof roll.max === "number") {
    return `${pad(roll.min)}-${pad(roll.max)}`;
  }
  return undefined;
}

function renderCell(cell: unknown, keyPrefix: string): ReactNode {
  if (typeof cell === "string") return <RulesText text={cell} />;
  if (typeof cell === "number") return `${cell}`;
  if (!isRecord(cell)) return null;
  if (str(cell.type) === "cell") {
    const label = str(cell.entry) ?? rollLabel(cell.roll);
    return label === undefined ? null : <RulesText text={label} />;
  }
  return renderEntry(cell as EntryNode, keyPrefix);
}

function renderTable(entry: EntryNode, keyPrefix: string): ReactNode {
  const caption = str(entry.caption);
  const colLabels = Array.isArray(entry.colLabels) ? entry.colLabels : [];
  const rows = Array.isArray(entry.rows) ? entry.rows : [];
  return (
    <table key={keyPrefix} className="w-full border-collapse text-left">
      {caption && <caption className="font-semibold">{caption}</caption>}
      {colLabels.length > 0 && (
        <thead>
          <tr>
            {colLabels.map((label, index) => (
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: a catalog table's columns never reorder.
                key={`${keyPrefix}-h${index}`}
                scope="col"
                className="border-border border-b px-2 py-1"
              >
                {typeof label === "string" ? <RulesText text={label} /> : null}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a catalog table's rows never reorder.
          <tr key={`${keyPrefix}-r${rowIndex}`}>
            {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a catalog table's cells never reorder.
              <td key={`${keyPrefix}-r${rowIndex}-c${cellIndex}`} className="px-2 py-1">
                {renderCell(cell, `${keyPrefix}-r${rowIndex}-c${cellIndex}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The node types that point at another catalog row — `"Frenzy|Barbarian||Berserker||3"` —
 * each under a field named for its type. The pointer's first segment is the row's name.
 */
const REF_FIELDS: Record<string, string> = {
  refClassFeature: "classFeature",
  refSubclassFeature: "subclassFeature",
  refOptionalfeature: "optionalfeature",
};

function renderEntry(entry: string | EntryNode, keyPrefix: string): ReactNode {
  if (typeof entry === "string") {
    return (
      <p key={keyPrefix}>
        <RulesText text={entry} />
      </p>
    );
  }
  const type = str(entry.type);
  if (type === "list") return renderList(entry, keyPrefix);
  if (type === "table") return renderTable(entry, keyPrefix);
  const refField = type === undefined ? undefined : REF_FIELDS[type];
  if (refField !== undefined) {
    const name = str(entry[refField])?.split("|")[0];
    return name ? <p key={keyPrefix}>{name}</p> : null;
  }
  return <Section key={keyPrefix} entry={entry} />;
}

/**
 * The `entries` field every catalog row carries: prose strings interleaved with lists,
 * tables and named subsections. A node type this renderer does not know yet falls back
 * to a plain wrapper around its own nested `entries`, never to its JSON.
 *
 * `headingLevel` is the level of the outermost subsection heading, one below the heading
 * the entries sit under. Left out, it continues from the section around this call.
 */
export function RulesEntries({
  entries,
  headingLevel,
}: {
  entries: Entries;
  headingLevel?: number;
}) {
  const rendered = (
    <Block content={entries}>
      {entries.map((entry, index) => renderEntry(entry, `e${index}`))}
    </Block>
  );
  return headingLevel === undefined ? (
    rendered
  ) : (
    <HeadingLevel value={headingLevel}>{rendered}</HeadingLevel>
  );
}
