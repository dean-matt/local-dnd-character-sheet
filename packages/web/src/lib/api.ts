/**
 * The one place that builds a request to `packages/api` and recognizes a failure. A
 * hook parses the response against the same Zod schema its route declares, so the type
 * on this side of the wire is the type the route wrote, never a hand-written duplicate.
 */
import type { z } from "zod";

const BASE_URL = "/api";

/** `status` is `0` for a network-level failure, where no HTTP response ever arrived. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

/** A TanStack Query `retry`: a 4xx is an answer a retry cannot change, so it surfaces at once. */
export const retryUnlessClientError = (failures: number, error: Error): boolean =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 3;

/** The `{ error: string }` envelope every route in `packages/api` returns on failure. */
function readErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return undefined;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, init);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "network request failed";
    throw new ApiError(message, 0, { cause });
  }
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
