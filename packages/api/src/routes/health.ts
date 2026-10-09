/**
 * Liveness probe. `version` names the catalog's upstream tag, `null` before one is built or
 * while it predates the schema, so a stale catalog never reads as a dead API.
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CatalogOutOfDateError } from "../db/content.ts";
import { getCatalogVersion } from "../db/queries/catalog-meta.ts";

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

  routes.openapi(health, (c) => c.json({ status: "ok" as const, version: catalogVersion() }, 200));

  function catalogVersion(): string | null {
    try {
      return getCatalogVersion(dataDir) ?? null;
    } catch (error) {
      if (error instanceof CatalogOutOfDateError) return null;
      throw error;
    }
  }

  return routes;
}
