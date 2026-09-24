import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { stubFetch } from "../test/stubFetch.ts";
import { ApiError, apiDelete, apiGet, apiMutate } from "./api.ts";

const widgetSchema = z.object({ name: z.string() });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiGet", () => {
  it("parses a 200 response against the schema", async () => {
    stubFetch(new Response(JSON.stringify({ name: "torch" }), { status: 200 }));
    await expect(apiGet("/widgets/1", widgetSchema)).resolves.toEqual({ name: "torch" });
  });

  it("requests the given path under /api", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ name: "torch" }), { status: 200 }));
    await apiGet("/widgets/1", widgetSchema);
    expect(fetchMock).toHaveBeenCalledWith("/api/widgets/1", undefined);
  });

  it("throws the error envelope's message on a non-2xx response", async () => {
    stubFetch(new Response(JSON.stringify({ error: "no widget with that id" }), { status: 404 }));
    await expect(apiGet("/widgets/missing", widgetSchema)).rejects.toMatchObject({
      message: "no widget with that id",
      status: 404,
    });
  });

  it("falls back to the status text when the body carries no error envelope", async () => {
    stubFetch(new Response("", { status: 500, statusText: "Internal Server Error" }));
    await expect(apiGet("/widgets/1", widgetSchema)).rejects.toMatchObject({
      message: "Internal Server Error",
      status: 500,
    });
  });

  it("throws rather than resolving when the body fails the schema", async () => {
    stubFetch(new Response(JSON.stringify({ name: 12 }), { status: 200 }));
    await expect(apiGet("/widgets/1", widgetSchema)).rejects.toThrow();
  });

  it("is an ApiError", async () => {
    stubFetch(new Response(JSON.stringify({ error: "nope" }), { status: 400 }));
    await expect(apiGet("/widgets/1", widgetSchema)).rejects.toBeInstanceOf(ApiError);
  });

  it("wraps a network-level fetch failure in an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiGet("/widgets/1", widgetSchema)).rejects.toBeInstanceOf(ApiError);
  });

  it("gives a network-level fetch failure status 0 and its message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiGet("/widgets/1", widgetSchema)).rejects.toMatchObject({
      message: "Failed to fetch",
      status: 0,
    });
  });
});

describe("apiMutate", () => {
  it("sends the method and JSON body, and parses the response", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ name: "lantern" }), { status: 200 }));
    const result = await apiMutate("PUT", "/widgets/1", widgetSchema, { name: "lantern" });

    expect(result).toEqual({ name: "lantern" });
    expect(fetchMock).toHaveBeenCalledWith("/api/widgets/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "lantern" }),
    });
  });

  it("throws rather than resolving on a non-2xx response", async () => {
    stubFetch(new Response(JSON.stringify({ error: "invalid widget" }), { status: 422 }));
    await expect(apiMutate("POST", "/widgets", widgetSchema, { name: "" })).rejects.toMatchObject({
      message: "invalid widget",
      status: 422,
    });
  });
});

describe("apiDelete", () => {
  it("resolves on a 204 with no body", async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiDelete("/widgets/1")).resolves.toBeUndefined();
  });

  it("throws on a non-2xx response", async () => {
    stubFetch(new Response(JSON.stringify({ error: "no widget with that id" }), { status: 404 }));
    await expect(apiDelete("/widgets/1")).rejects.toMatchObject({ status: 404 });
  });
});
