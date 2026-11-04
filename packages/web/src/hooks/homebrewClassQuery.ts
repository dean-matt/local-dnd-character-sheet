import {
  homebrewClassDetailSchema,
  homebrewClassFeaturesSchema,
  homebrewClassResourcesSchema,
} from "@dnd/catalog";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { apiGet } from "../lib/api.ts";
import { retryUnlessClientError } from "../lib/retryUnlessClientError.ts";

export const homebrewClassKey = (id: string | undefined) => ["homebrew", "classes", id];

/** The query for one homebrew class, which fetches nothing while `id` is absent. */
export const homebrewClassQuery = (id: string | undefined) =>
  queryOptions({
    queryKey: homebrewClassKey(id),
    queryFn: id
      ? () => apiGet(`/homebrew/classes/${encodeURIComponent(id)}`, homebrewClassDetailSchema)
      : skipToken,
    retry: retryUnlessClientError,
  });

/** The features a homebrew class or subclass saves beside its row. */
export const homebrewFeaturesQuery = (collection: "classes" | "subclasses", id: string) =>
  queryOptions({
    queryKey: ["homebrew", collection, id, "features"],
    queryFn: () =>
      apiGet(
        `/homebrew/${collection}/${encodeURIComponent(id)}/features`,
        homebrewClassFeaturesSchema,
      ),
    retry: retryUnlessClientError,
  });

export const homebrewClassResourcesQuery = (id: string) =>
  queryOptions({
    queryKey: [...homebrewClassKey(id), "resources"],
    queryFn: () =>
      apiGet(`/homebrew/classes/${encodeURIComponent(id)}/resources`, homebrewClassResourcesSchema),
    retry: retryUnlessClientError,
  });
