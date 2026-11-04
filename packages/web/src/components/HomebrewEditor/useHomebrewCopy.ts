import { searchResponseSchema } from "@dnd/catalog";
import type { EntryRef } from "@dnd/character";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  homebrewClassResourcesQuery,
  homebrewFeaturesQuery,
} from "../../hooks/homebrewClassQuery.ts";
import type { HomebrewCollection } from "../../hooks/useHomebrew.ts";
import { apiGet } from "../../lib/api.ts";
import { copiedEntry, copyName } from "./homebrewCopy.ts";
import type { HomebrewEntry } from "./homebrewDraft.ts";

const withJson = z.looseObject({ json: z.record(z.string(), z.unknown()) });
const named = z.array(z.looseObject({ name: z.string() }));

const segments = (...parts: string[]) => parts.map(encodeURIComponent).join("/");

async function sourceEntry(
  collection: HomebrewCollection,
  ref: EntryRef,
  queryClient: QueryClient,
): Promise<Record<string, unknown>> {
  if ("homebrewId" in ref) {
    const { json } = await apiGet(`/homebrew/${collection}/${segments(ref.homebrewId)}`, withJson);
    if (collection !== "classes") return json;
    // A class's features and resource tables live beside its row, so they are read apart.
    const [features, resources] = await Promise.all([
      queryClient.fetchQuery(homebrewFeaturesQuery("classes", ref.homebrewId)),
      queryClient.fetchQuery(homebrewClassResourcesQuery(ref.homebrewId)),
    ]);
    return { ...json, features, resources };
  }
  // A catalog skill is a rules lookup, with no route of its own.
  const path = collection === "skills" ? "/catalog/skill" : `/${collection}`;
  const { json } = await apiGet(`${path}/${segments(ref.name, ref.source)}`, withJson);
  if (collection !== "classes") return json;
  // A catalog class's features are rows of its own that a copy does not bring, so its
  // references to them would list features the copy lacks.
  const { classFeatures, subclassTitle, ...copied } = json;
  return copied;
}

/**
 * Every name of `type` the catalog or homebrew holds that a copy of `name` could take.
 * `/search` matches each name holding `name`, ranked by how closely, and caps a page at 200:
 * a name with more than 200 such rows could miss one, and paging `total` is the way out.
 */
async function takenNames(collection: HomebrewCollection, type: string, name: string) {
  const params = new URLSearchParams({ q: name, type, limit: "200" });
  // The homebrew list too: `/search` holds no homebrew skill.
  const [search, homebrew] = await Promise.all([
    apiGet(`/search?${params}`, searchResponseSchema),
    apiGet(`/homebrew/${collection}`, named),
  ]);
  return [...search.items.map((hit) => hit.name), ...homebrew.map((row) => row.name)];
}

/**
 * Reads the entry `ref` names, of the kind `/search` calls `type`, as a new entry of
 * `collection` starts from it: its fields, a homebrew class's features and resources among
 * them, under a name no entry of the kind holds. It writes nothing.
 */
export function useHomebrewCopy(collection: HomebrewCollection, type: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ref, name }: { ref: EntryRef; name: string }): Promise<HomebrewEntry> => {
      const [entry, taken] = await Promise.all([
        sourceEntry(collection, ref, queryClient),
        takenNames(collection, type, name),
      ]);
      return copiedEntry(entry, copyName(name, taken));
    },
  });
}
