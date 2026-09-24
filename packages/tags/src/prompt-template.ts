/**
 * Upstream's second markup grammar, nested inside dice notation for a value the reader
 * supplies: `#$prompt_number:title=Enter a Modifier$#`. It shares no syntax with
 * `{@tag}` — no braces, no pipes — so the tag parser never sees it as a tag, and
 * `plain` expands it wherever an argument is flattened to text.
 *
 * An unregistered variable degrades to its title, or to its own name — never to the raw
 * template — the same bargain an unknown `{@tag}` makes.
 */

const TEMPLATE = /#\$(\w+)(?::([^$]*))?\$#/g;

/**
 * `key=value` pairs, comma-separated. A title holding its own comma has no escape and
 * splits early; the corpus has none today. Widen this the day `pnpm tags:audit` finds
 * one.
 */
function params(raw: string | undefined): Map<string, string> {
  const parsed = new Map<string, string>();
  if (raw === undefined) return parsed;
  for (const pair of raw.split(",")) {
    const eq = pair.indexOf("=");
    if (eq !== -1) parsed.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return parsed;
}

/** `title`, and the range or default that bounds the number, in one bracketed phrase. */
function promptNumber(values: Map<string, string>): string {
  const title = values.get("title") ?? "a number";
  const min = values.get("min");
  const max = values.get("max");
  const fallback = values.get("default");

  const bounds: string[] = [];
  if (min !== undefined && max !== undefined) bounds.push(`${min}–${max}`);
  else if (min !== undefined) bounds.push(`min ${min}`);
  else if (max !== undefined) bounds.push(`max ${max}`);
  if (fallback !== undefined) bounds.push(`default ${fallback}`);

  return bounds.length === 0 ? `[${title}]` : `[${title}: ${bounds.join(", ")}]`;
}

const RENDERERS: Record<string, (values: Map<string, string>) => string> = {
  prompt_number: promptNumber,
};

/** Replaces every `#$…$#` template in `value` with the text a reader can act on. */
export function expandPromptTemplates(value: string): string {
  return value.replace(TEMPLATE, (_match, name: string, raw: string | undefined) => {
    const values = params(raw);
    const render = RENDERERS[name];
    return render === undefined ? `[${values.get("title") ?? name}]` : render(values);
  });
}
