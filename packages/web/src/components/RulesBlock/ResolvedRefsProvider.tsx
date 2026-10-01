import { type ReactNode, useMemo } from "react";
import { useResolvedRefs } from "../../hooks/useResolvedRefs.ts";
import { refKey, refsIn } from "../../lib/rulesRefs.ts";
import { ResolvedRefs } from "../resolvedRefsContext.ts";

/** Resolves every reference in `content` in one request, for the rules text inside it. */
export function ResolvedRefsProvider({
  content,
  children,
}: {
  content: unknown;
  children: ReactNode;
}) {
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
