import { searchFeatureTypesResponseSchema } from "@dnd/catalog";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

/** Every optional-feature type code the catalog or homebrew offers. Homebrew changes it, so it refetches on mount. */
export function useSearchFeatureTypes() {
  return useQuery({
    queryKey: ["search", "feature-types"],
    queryFn: async () =>
      (await apiGet("/search/feature-types", searchFeatureTypesResponseSchema)).featureTypes,
    retry: retryUnlessClientError,
  });
}
