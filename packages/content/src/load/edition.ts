/**
 * Which of the two rulesets a source belongs to.
 *
 * No spell carries an `edition` field, so the source decides. Every 2024 book has
 * its own abbreviation, which keeps this list short and closed. A source missing
 * from it lands in `classic` — add the abbreviation when upstream ships a book.
 */
const ONE_EDITION_SOURCES = new Set([
  "ABH",
  "EFA",
  "FRAiF",
  "FRHoF",
  "LFL",
  "NF",
  "RHW",
  "XDMG",
  "XMM",
  "XPHB",
  "XSAC",
]);

export function editionOf(source: string): "classic" | "one" {
  return ONE_EDITION_SOURCES.has(source) ? "one" : "classic";
}
