/**
 * The one place that builds a request to `packages/api` and recognizes a failure. A
 * hook parses the response against the same Zod schema its route declares, so the type
 * on this side of the wire is the type the route wrote, never a hand-written duplicate.
 */
import type { z } from "zod";

const BASE_URL = "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The `{ error: string }` envelope every route in `packages/api` returns on failure. */
function readErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return undefined;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (!response.ok) {
    const message = readErrorMessage(await response.json().catch(() => undefined));
    throw new ApiError(message ?? response.statusText, response.status);
  }
  return response;
}

/** A `GET` that parses its body against `schema`, so a route that drifts fails loudly here. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await request(path);
  return schema.parse(await response.json());
}

/** A `POST` or `PUT` carrying a JSON body, parsing the response the same way `apiGet` does. */
export async function apiMutate<T>(
  method: "POST" | "PUT",
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
): Promise<T> {
  const response = await request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return schema.parse(await response.json());
}

/** A `DELETE`, which every route in `packages/api` answers with `204` and no body. */
export async function apiDelete(path: string): Promise<void> {
  await request(path, { method: "DELETE" });
}
