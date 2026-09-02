import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

export const app = new OpenAPIHono();

const HealthResponse = z
  .object({ status: z.literal("ok"), version: z.string() })
  .openapi("HealthResponse");

app.openapi(
  createRoute({
    method: "get",
    path: "/health",
    tags: ["meta"],
    summary: "Liveness probe",
    responses: {
      200: {
        description: "The API is running",
        content: { "application/json": { schema: HealthResponse } },
      },
    },
  }),
  (c) => c.json({ status: "ok" as const, version: "0.0.0" }),
);

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "local-dnd-character-sheet", version: "0.0.0" },
});
