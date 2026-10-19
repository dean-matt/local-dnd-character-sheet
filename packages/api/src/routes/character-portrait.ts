/**
 * Read, replace and remove for the image behind a character's avatar. A write carries the
 * raw image as its body. The type is read from the image's own leading bytes, never from
 * the `Content-Type` alone, and must match it, so nothing but a PNG, JPEG, GIF or WebP is
 * ever stored or served back.
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import type { CharactersDb } from "../db/queries/characters.ts";
import { getPortrait, removePortrait, setPortrait } from "../db/queries/portraits.ts";
import { errorSchema, notFound } from "./errors.ts";

/**
 * An avatar draws at 48px at most, so 2 MiB holds any sensible image. Every snapshot in
 * `data/backups/` carries each portrait, which is what keeps the cap low; resizing on upload
 * is the way past it.
 */
export const PORTRAIT_MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES = new Map<string, (bytes: Uint8Array) => boolean>([
  ["image/png", (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ["image/jpeg", (b) => startsWith(b, [0xff, 0xd8, 0xff])],
  ["image/gif", (b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")],
  ["image/webp", (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")],
]);

const MEDIA_TYPES = [...SIGNATURES.keys()];

function startsWith(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, i) => bytes[i] === byte);
}

function ascii(bytes: Uint8Array, offset: number, text: string) {
  return [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
}

const binary = z.string().openapi({ format: "binary" });
const imageContent = Object.fromEntries(MEDIA_TYPES.map((type) => [type, { schema: binary }]));

const idParam = z.object({ id: z.string() });

const NOT_FOUND = "No character with that id";

const read = createRoute({
  method: "get",
  path: "/characters/{id}/portrait",
  tags: ["characters"],
  summary: "Read a character's portrait",
  request: { params: idParam },
  responses: {
    200: { description: "The image, as uploaded", content: imageContent },
    404: {
      description: "No character with that id, or it has no portrait",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const write = createRoute({
  method: "put",
  path: "/characters/{id}/portrait",
  tags: ["characters"],
  summary: "Replace a character's portrait",
  description: `The body is the image itself, at most ${PORTRAIT_MAX_BYTES} bytes.`,
  middleware: [
    bodyLimit({
      maxSize: PORTRAIT_MAX_BYTES,
      onError: (c) =>
        c.json({ error: `The image is larger than ${PORTRAIT_MAX_BYTES / 1024 / 1024} MiB` }, 413),
    }),
  ],
  request: { params: idParam, body: { content: imageContent, required: true } },
  responses: {
    204: { description: "The portrait was stored" },
    404: notFound("character"),
    413: {
      description: `The image is over ${PORTRAIT_MAX_BYTES} bytes, so nothing was stored`,
      content: { "application/json": { schema: errorSchema } },
    },
    415: {
      description: "The body is not a PNG, JPEG, GIF or WebP image, so nothing was stored",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const remove = createRoute({
  method: "delete",
  path: "/characters/{id}/portrait",
  tags: ["characters"],
  summary: "Remove a character's portrait",
  request: { params: idParam },
  responses: {
    204: { description: "The character has no portrait" },
    404: notFound("character"),
  },
});

export function characterPortraitRoutes(db: CharactersDb) {
  const routes = new OpenAPIHono();

  routes.openapi(read, (c) => {
    const portrait = getPortrait(db, c.req.valid("param").id);
    if (!portrait) return c.json({ error: "No portrait for that character" }, 404);
    return c.body(new Uint8Array(portrait.image), 200, {
      "Content-Type": portrait.mediaType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    });
  });

  routes.openapi(write, async (c) => {
    const { id } = c.req.valid("param");
    const declared = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const image = new Uint8Array(await c.req.arrayBuffer());
    const matches = SIGNATURES.get(declared);
    if (!matches?.(image)) {
      return c.json({ error: "Upload a PNG, JPEG, GIF or WebP image" }, 415);
    }
    if (!setPortrait(db, id, { mediaType: declared, image: Buffer.from(image) })) {
      return c.json({ error: NOT_FOUND }, 404);
    }
    return c.body(null, 204);
  });

  routes.openapi(remove, (c) => {
    if (!removePortrait(db, c.req.valid("param").id)) return c.json({ error: NOT_FOUND }, 404);
    return c.body(null, 204);
  });

  return routes;
}
