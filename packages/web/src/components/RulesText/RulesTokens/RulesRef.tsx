import type { Token } from "@dnd/tags";
import { useContext, useState } from "react";
import { useReturnFocus } from "../../../hooks/useReturnFocus.ts";
import { paragraphs } from "../../../lib/rulesProse.ts";
import { refKey } from "../../../lib/rulesRefs.ts";
import { CatalogDetail } from "../../CatalogDetail.tsx";
import { CatalogEntry } from "../../CatalogEntry.tsx";
import { InModal } from "../../inModalContext.ts";
import { Popover } from "../../Popover.tsx";
import { ResolvedRefs } from "../../resolvedRefsContext.ts";

type RefToken = Extract<Token, { kind: "ref" }>;

/**
 * A reference the catalog answers opens a popover of that row's text, and from there its
 * whole detail in a modal. One it does not answer — or has not yet — renders as its
 * display text alone, its fields carried on the span as data attributes.
 *
 * The modal sits beside the popover rather than inside it, since moving focus into the
 * modal closes the popover. Closing the modal hands focus back to the reference itself.
 * Inside a modal already, the row replaces the entry showing there instead.
 */
export function RulesRef({ token }: { token: RefToken }) {
  const row = useContext(ResolvedRefs)?.get(refKey(token));
  const [detailOpen, setDetailOpen] = useState(false);
  const reference = useReturnFocus<HTMLButtonElement>(detailOpen);
  const modal = useContext(InModal);
  const prose = row === undefined ? [] : paragraphs(row.entries);
  // A row with no prose and no detail — every monster, whose stat block is not `entries` —
  // would open onto its name alone, so it stays text.
  if (row === undefined || (prose.length === 0 && row.path === undefined)) {
    return (
      <span data-tag={token.tag} data-name={token.name} data-source={token.source}>
        {token.display}
      </span>
    );
  }
  const { path } = row;
  return (
    <>
      <Popover trigger={token.display} label={`${row.name} (${row.source})`} triggerRef={reference}>
        <span className="block font-semibold">
          {row.name} <span className="font-normal text-muted">{row.source}</span>
        </span>
        {prose.map((text, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a catalog row's prose never reorders.
          <span key={index} className="mt-1 block">
            {text}
          </span>
        ))}
        {path && (
          <button
            type="button"
            aria-haspopup={modal ? undefined : "dialog"}
            onClick={() =>
              modal ? modal.open(<CatalogEntry address={path} />) : setDetailOpen(true)
            }
            className="mt-1 block cursor-pointer underline"
          >
            Open {row.name}
          </button>
        )}
      </Popover>
      {path && detailOpen && <CatalogDetail address={path} onClose={() => setDetailOpen(false)} />}
    </>
  );
}
