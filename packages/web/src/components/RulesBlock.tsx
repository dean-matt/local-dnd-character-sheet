/**
 * The outermost `RulesText`, `RulesEntries` or `RulesBlock` is a block: it resolves every
 * reference inside it in one request, and a reference the catalog answers opens a popover
 * of that row's text. One it does not answer — or has not yet — renders as its display
 * text alone, its fields carried on the span as data attributes, and so does a roll
 * until a later tier makes it clickable.
 */
import { type ReactNode, useContext } from "react";
import { ResolvedRefsProvider } from "./ResolvedRefsProvider.tsx";
import { ResolvedRefs } from "./resolvedRefsContext.ts";

/**
 * Resolves `content`'s references unless a block around it already does. A caller
 * rendering many `RulesEntries` wraps them in one to resolve them in one request.
 */
export function RulesBlock({ content, children }: { content: unknown; children: ReactNode }) {
  const outer = useContext(ResolvedRefs);
  return outer === null ? (
    <ResolvedRefsProvider content={content}>{children}</ResolvedRefsProvider>
  ) : (
    children
  );
}
