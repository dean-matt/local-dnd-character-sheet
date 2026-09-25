/**
 * Resolves the `{@tag}` references one rendered block carries, in one request rather
 * than one per tag. A `POST` because the batch is a body a query string would have to
 * encode; it reads and writes nothing.
 */
import {
  entriesSchema,
  type ResolvedRef,
  refResolveRequestSchema,
  refResolveResponseSchema,
} from "@dnd/catalog";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { type ResolvedRow, resolveRefs } from "../db/queries/refs.ts";

const entriesAt = (json: Record<string, unknown>, key: string) =>
  entriesSchema.safeParse(json[key]).data ?? [];

/** A spell's upcast rule sits beside `entries`, and its text reads complete only with it. */
function toResolvedRef(row: ResolvedRow): ResolvedRef {
  const json = JSON.parse(row.json) as Record<string, unknown>;
  return {
    name: row.name,
    source: row.source,
    entries: [...entriesAt(json, "entries"), ...entriesAt(json, "entriesHigherLevel")],
    ...(row.path === undefined ? {} : { path: row.path }),
  };
}

const resolve = createRoute({
  method: "post",
  path: "/refs/resolve",
  tags: ["catalog"],
  summary: "Resolve a block's {@tag} references to catalog rows, in order",
  request: {
    body: { required: true, content: { "application/json": { schema: refResolveRequestSchema } } },
  },
  responses: {
    200: {
      description: "The row each reference names, or null where the catalog has none",
      content: { "application/json": { schema: refResolveResponseSchema } },
    },
  },
});

export function refsRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(resolve, (c) => {
    const { refs } = c.req.valid("json");
    const rows = resolveRefs(dataDir, refs);
    return c.json(
      { refs: rows.map((row) => (row === undefined ? null : toResolvedRef(row))) },
      200,
    );
  });

  return routes;
}
