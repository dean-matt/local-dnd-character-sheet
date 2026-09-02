---
name: tag-render
description: Add or fix support for a 5etools {@tag} in the renderer. Use when rules text renders wrong, a link dangles, or a new tag needs handling. Covers the tag grammar, the token contract, degradation rules, and the text/link/roll tiers.
---

# Rendering 5etools tags

Rules text is markup, not prose. The parser is in `packages/shared/src/tags/` and
returns tokens; `packages/web` renders tokens to React nodes. Keep those separate — the
API needs plain text from the same parser for the FTS index.

Twelve tags cover ~95% of occurrences. Counts and the full list are in
[`docs/5etools-data.md`](../../../docs/5etools-data.md).

## Grammar

```
{@tag}                              bare
{@tag display}                      display text only
{@tag name|source}                  reference
{@tag name|source|display}          reference with different display text
{@tag name|source|display|extra}    tag-specific trailing arguments
```

Pipes separate arguments. An empty argument means "default" — `{@spell fireball||Fire}`
has no explicit source. Nesting occurs: `{@i {@spell fireball}}`.

## Token contract

```ts
type Token =
  | { kind: "text"; value: string }
  | { kind: "ref"; tag: string; name: string; source?: string; display: string }
  | { kind: "roll"; notation: string; display: string; rollable: boolean }
  | { kind: "style"; style: "italic" | "bold"; children: Token[] };
```

Every token carries a `display` string. That is what makes degradation safe: any
renderer can fall back to `display` without knowing the tag.

## Degradation rules

**An unknown tag is never an error.** Emit `{kind: "text", value: display}` and move on.
Upstream adds tags; this must not break when they do.

**`{@filter}` always degrades to text.** It links to a 5etools filtered list page, which
does not exist here. 727 occurrences — do not special-case them one at a time.

**A reference to a missing entity still renders**, as its display text without a link.
The catalog may legitimately not have the target.

Feed `generated/gendata-tag-redirects.json` to the resolver so renamed upstream entries
still resolve.

## Tiers

Support is built in layers. Each is additive and the token shape does not change:

```
1  text    every tag renders its display string        no lookups, no interaction
2  link    ref tokens resolve to catalog rows          popovers, tooltips
3  roll    roll tokens become click-to-roll buttons    writes to roll_log
```

Do not skip to tier 3 for a tag that has no tier 1 test.

## Testing

Every tag gets a case in `packages/shared/src/tags/parse.test.ts` covering: the bare
form, the piped form, an unknown-tag fallback, and one real string copied verbatim from
`vendor/5etools/`. Real strings catch the nesting and escaping that invented cases miss.
