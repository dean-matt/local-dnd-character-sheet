import { classRecordSchema, homebrewClassRecordSchema } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";
import { useHomebrew } from "./useHomebrew.ts";

/** One class a subclass can belong to, as the subclass input's `parent` names it. */
interface ParentClass {
  parent: { name: string; source: string } | { classId: string };
  label: string;
}

const MAX_CLASSES = 200;
const catalogClassesSchema = z.object({ items: z.array(classRecordSchema) });

/**
 * The classes of one edition a homebrew subclass can belong to, catalog classes first and
 * homebrew classes after, each class in its own edition only. `pending` and `error` speak
 * for both reads.
 */
export function useParentClasses(edition: CharacterRecord["edition"]) {
  const catalog = useQuery({
    queryKey: ["classes", "parents", edition],
    queryFn: () => apiGet(`/classes?edition=${edition}&limit=${MAX_CLASSES}`, catalogClassesSchema),
  });
  const { list } = useHomebrew("classes", homebrewClassRecordSchema);
  const classes: ParentClass[] = [
    ...(catalog.data?.items ?? []).map(({ name, source }) => ({
      parent: { name, source },
      label: `${name} (${source})`,
    })),
    ...(list.data ?? [])
      .filter((row) => row.edition === edition)
      .map(({ id, name }) => ({ parent: { classId: id }, label: `${name} (Homebrew)` })),
  ];
  return {
    classes,
    pending: catalog.isPending || list.isPending,
    error: catalog.error ?? list.error,
  };
}
