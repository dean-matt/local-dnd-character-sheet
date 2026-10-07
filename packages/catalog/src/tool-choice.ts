import { z } from "zod";
import type { ToolType } from "./item-kind.ts";

/**
 * A pick of tools a row offers: `count` of the tools `names` holds, lowercased as upstream
 * writes them, or of any tool of a kind `types` holds.
 */
export type ToolChoice = { names: string[]; types: ToolType[]; count: number };

/** Upstream's keys for a pick of any tool of a kind, beside a `choose` list. */
const ANY_OF_TYPE: Record<string, ToolType> = {
  anyArtisansTool: "artisan",
  anyMusicalInstrument: "instrument",
  anyGamingSet: "gaming",
};

/** The names a `choose.from` list writes for every tool of a kind rather than one tool. */
const TYPE_OF_NAME: Record<string, ToolType> = {
  anyartisanstool: "artisan",
  "artisan's tools": "artisan",
  "musical instrument": "instrument",
  "gaming set": "gaming",
};

const countSchema = z.int().min(1);
const chooseSchema = z.looseObject({
  from: z.array(z.string()).min(1),
  count: countSchema.optional(),
});

/** One alternative's tools: those it grants outright, and the picks it offers. */
function readAlternative(alternative: unknown): { fixed: string[]; picks: ToolChoice[] } {
  if (typeof alternative !== "object" || alternative === null) return { fixed: [], picks: [] };
  const fixed: string[] = [];
  const picks: ToolChoice[] = [];
  for (const [key, value] of Object.entries(alternative)) {
    const anyType = ANY_OF_TYPE[key];
    const count = countSchema.safeParse(value).data;
    const choose = key === "choose" ? chooseSchema.safeParse(value).data : undefined;
    if (value === true) fixed.push(key.split("|")[0]?.trim().toLowerCase() ?? key);
    else if (anyType && count) picks.push({ names: [], types: [anyType], count });
    else if (choose) {
      const from = choose.from.map((name) => name.toLowerCase());
      picks.push({
        names: from.filter((name) => TYPE_OF_NAME[name] === undefined),
        types: [...new Set(from.flatMap((name) => TYPE_OF_NAME[name] ?? []))],
        count: choose.count ?? 1,
      });
    }
  }
  return { fixed, picks };
}

/**
 * The picks a `toolProficiencies` list offers. A one-element list offers each of its
 * picks, beside the tools it grants outright, which `proficiencyGrantsSchema` reads. A
 * list of alternatives grants nothing outright, so it offers one pick of as many tools as
 * its largest alternative holds, from every tool any alternative names: `Monk` (PHB) takes
 * an artisan's tool or a musical instrument. That merge lets `House Agent` (ERLW), the one
 * row whose alternatives pair named tools, take a pair across two alternatives without a
 * note; asking the alternative first is the way out. A malformed list offers nothing
 * rather than refusing the row.
 */
const choicesSchema = z
  .array(z.unknown())
  .optional()
  .catch(undefined)
  .transform((alternatives): ToolChoice[] => {
    const read = (alternatives ?? []).map(readAlternative);
    if (read.length <= 1) return read[0]?.picks ?? [];
    const count = Math.max(
      ...read.map(({ fixed, picks }) =>
        picks.reduce((sum, pick) => sum + pick.count, fixed.length),
      ),
    );
    const all = read.flatMap(({ fixed, picks }) => [{ names: fixed, types: [] }, ...picks]);
    return count === 0
      ? []
      : [
          {
            names: [...new Set(all.flatMap((pick) => pick.names))],
            types: [...new Set(all.flatMap((pick) => pick.types))],
            count,
          },
        ];
  });

/** The tool picks a class row offers a character who starts in it. */
export const classToolChoicesSchema = z
  .looseObject({
    startingProficiencies: z
      .looseObject({ toolProficiencies: choicesSchema })
      .optional()
      .catch(undefined),
  })
  .transform((row) => row.startingProficiencies?.toolProficiencies ?? []);

/** The tool picks a background row offers, beside the tools it grants outright. */
export const backgroundToolChoicesSchema = z
  .looseObject({ toolProficiencies: choicesSchema })
  .transform((row) => row.toolProficiencies);
