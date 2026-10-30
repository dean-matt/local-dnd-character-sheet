import { homebrewHistorySchema } from "@dnd/catalog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../lib/api.ts";
import type { HomebrewCollection } from "./useHomebrew.ts";

/** What the editor's Undo button needs to revert one row. */
export interface HomebrewUndo {
  /** False until the row has been saved over since the API started. */
  available: boolean;
  pending: boolean;
  failure: string | undefined;
  onUndo: () => void;
}

interface Target {
  collection: HomebrewCollection;
  id: string;
}

const rowPath = ({ collection, id }: Target) => `/homebrew/${collection}/${encodeURIComponent(id)}`;

/**
 * What the API still holds to undo a homebrew change: the rows whose latest save reverts, and
 * the rows deleted since it started. A revert or a restore refreshes every query, as a save does.
 */
export function useHomebrewHistory() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries();
  const history = useQuery({
    queryKey: ["homebrew", "history"],
    queryFn: () => apiGet("/homebrew/history", homebrewHistorySchema),
  });
  const revert = useMutation({
    mutationFn: (target: Target) => apiPost(`${rowPath(target)}/revert`),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: (target: Target) => apiPost(`${rowPath(target)}/restore`),
    onSuccess: refresh,
  });
  /** The editor's Undo for one row; `onUndone` runs once the row reads as it did. */
  const undoOf = (
    collection: HomebrewCollection,
    id: string,
    onUndone: () => void,
  ): HomebrewUndo => ({
    available:
      history.data?.reversible.some((row) => row.collection === collection && row.id === id) ??
      false,
    pending: revert.isPending,
    failure: revert.error?.message,
    onUndo: () => revert.mutate({ collection, id }, { onSuccess: onUndone }),
  });
  return { history, restore, undoOf, resetRevert: revert.reset };
}
