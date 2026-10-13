import { useMutationState } from "@tanstack/react-query";
import { charactersKey } from "../../../hooks/characterKeys.ts";
import { useFleeting } from "../../../hooks/useFleeting.ts";

/**
 * The sheet's one save status: "Saving…" while any write to a character is in flight, then
 * "Saved" for a moment once the last one lands. A write that fails says nothing here; its
 * field raises a toast instead. It holds the bar's free space, pushing what follows to the end.
 */
export function SaveIndicator() {
  const statuses = useMutationState({
    filters: { mutationKey: charactersKey },
    select: (mutation) => mutation.state.status,
  });
  const saving = statuses.includes("pending");
  const saved = useFleeting(!saving && statuses.at(-1) === "success");
  return (
    // Mounted while empty: a live region added with its text is often not announced.
    <span role="status" className="ml-auto shrink-0 text-muted text-row">
      {saving ? "Saving…" : saved ? "Saved" : ""}
    </span>
  );
}
