/**
 * The outermost `RulesText`, `RulesEntries` or `RulesBlock` is a block: it resolves every
 * reference inside it in one request.
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
