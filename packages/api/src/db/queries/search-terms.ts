const LIKE_ESCAPE = "!";

/** Escapes a term for a `LIKE ... ESCAPE '!'` pattern, so a literal `%` or `_` cannot turn part of a search term into a wildcard. */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[!%_]/g, (char) => `${LIKE_ESCAPE}${char}`);
}

/** Quotes a term as an FTS5 phrase-prefix query, so punctuation in it cannot break the query's own syntax. */
export function ftsPrefixQuery(term: string): string {
  return `"${term.replace(/"/g, '""')}"*`;
}
