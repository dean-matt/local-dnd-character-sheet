import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet } from "../lib/api.ts";

const holdersSchema = z.array(z.object({ id: z.string(), name: z.string() }));

/** The characters holding one homebrew skill; idle while `id` is absent, as for a skill not yet saved. */
export function useSkillHolders(id: string | undefined) {
  return useQuery({
    queryKey: ["homebrew", "skills", id, "holders"],
    queryFn: () =>
      apiGet(`/homebrew/skills/${encodeURIComponent(id ?? "")}/holders`, holdersSchema),
    enabled: id !== undefined,
  });
}
