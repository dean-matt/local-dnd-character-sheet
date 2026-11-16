import { itemRecordSchema, toolAbility } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** The 2024 sources that print a tool, in the order read; a tool outside them reads as unprinted. */
const PRINTED_SOURCES = ["XPHB", "XDMG"];

/**
 * The ability the 2024 books print for a tool: the first source holding a row of that name
 * that prints one. A missing row is no ability; any other failure surfaces and is never cached
 * as an answer.
 */
export function useToolPrintedAbility(name: string, edition: CharacterRecord["edition"]) {
  return useQuery({
    queryKey: ["catalog", "toolAbility", name],
    queryFn: async () => {
      for (const source of PRINTED_SOURCES) {
        try {
          const row = await apiGet(
            `/items/${encodeURIComponent(name)}/${source}`,
            itemRecordSchema,
          );
          const ability = toolAbility(row.json);
          if (ability) return ability;
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
      }
      return null;
    },
    enabled: edition === "one",
    staleTime: Number.POSITIVE_INFINITY,
    retry: retryUnlessClientError,
  });
}
