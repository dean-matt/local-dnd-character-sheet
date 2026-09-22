/** Liveness probe. `version` names the catalog's upstream tag, `null` before one is built. */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getCatalogVersion } from "../db/queries/content.ts";

const healthResponseSchema = z
  .object({ status: z.literal("ok"), version: z.string().nullable() })
  .openapi("HealthResponse");

const health = createRoute({
  method: "get",
  path: "/health",
  tags: ["meta"],
  summary: "Liveness probe",
  responses: {
    200: {
      description: "The API is running",
      content: { "application/json": { schema: healthResponseSchema } },
    },
  },
});

export function healthRoutes(dataDir: string) {
  const routes = new OpenAPIHono();

  routes.openapi(health, (c) =>
    c.json({ status: "ok" as const, version: getCatalogVersion(dataDir) ?? null }, 200),
  );

  return routes;
}
