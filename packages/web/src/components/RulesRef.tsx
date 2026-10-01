import type { Token } from "@dnd/tags";
import { useContext } from "react";
import { Link } from "react-router";
import { paragraphs } from "../lib/rulesProse.ts";
import { refKey } from "../lib/rulesRefs.ts";
import { Popover } from "./Popover.tsx";
import { ResolvedRefs } from "./resolvedRefsContext.ts";

type RefToken = Extract<Token, { kind: "ref" }>;

/**
 * A reference the catalog answers opens a popover of that row's text. One it does not
 * answer — or has not yet — renders as its display text alone, its fields carried on the
 * span as data attributes.
 */
export function RulesRef({ token }: { token: RefToken }) {
  const row = useContext(ResolvedRefs)?.get(refKey(token));
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
