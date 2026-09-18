/**
 * The recursive `entries` field every 5etools row carries — prose strings interleaved
 * with structured nodes such as lists and tables, each of which can nest more entries.
 *
 * Only the recursion is modeled. A node's other fields (`type`, `items`, `caption`, and
 * every field specific to one node type) pass through unparsed: rendering them is the
 * renderer's job, and validating each one here would mean re-deriving upstream's node
 * vocabulary rather than the shape a `{@tag}` walk actually needs, which is a string to
 * hand to `parseTags`.
 */
import { z } from "zod";

type EntryNode = { entries?: Entries } & Record<string, unknown>;
export type Entries = (string | EntryNode)[];

const entryNodeSchema: z.ZodType<EntryNode> = z.looseObject({
  entries: z.lazy(() => entriesSchema).optional(),
});

export const entriesSchema: z.ZodType<Entries> = z.array(z.union([z.string(), entryNodeSchema]));
