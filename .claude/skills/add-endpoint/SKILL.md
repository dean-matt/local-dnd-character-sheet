---
name: add-endpoint
description: Add an API route end to end. Use when creating or changing any endpoint in packages/api. Enforces the Zod-to-OpenAPI-to-Drizzle-to-query-hook order so the generated spec and the Bruno collection cannot drift from the code.
---

# Adding an endpoint

The generated OpenAPI spec is the contract. It is derived from the Zod schemas on the
route, so it cannot drift — unless someone hand-rolls a type instead of reusing the
schema. That is the failure this order prevents.

## The order

```
1  packages/character/src/<domain>.ts        Zod schema — the single definition
2  packages/api/src/routes/<domain>.ts       createRoute() using that schema
3  packages/api/src/db/queries/<domain>.ts   Drizzle query (or raw SQL for content.db)
4  packages/web/src/hooks/use<Domain>.ts     TanStack Query hook
5  verify http://127.0.0.1:8787/openapi.json shows the route
```

Never skip step 1. A schema defined inline in a route cannot be reused by the web
client, which is how a hand-written duplicate type appears and then drifts.

## Route shape

```ts
import { createRoute, z } from "@hono/zod-openapi";
import { CharacterSchema } from "@dnd/character";

const getCharacter = createRoute({
  method: "get",
  path: "/characters/{id}",
  tags: ["characters"],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "The character",
      content: { "application/json": { schema: CharacterSchema } },
    },
    404: { description: "No character with that id" },
  },
});
```

## Which database

| Reading | Use |
|---|---|
| `content.db` | raw SQL through `better-sqlite3` — no Drizzle, FTS5 queries live here |
| `characters.db`, `homebrew.db` | Drizzle |

A search endpoint that spans the catalog and homebrew queries both and merges. Homebrew
rows carry source `HB` so the client can badge them.

## Rules

**Filter on edition.** Any content query without an edition filter returns both
rulesets and shows duplicates.

**Return references, not copies.** A character's spell list is `{name, source}` pairs.
Resolve them in a separate lookup so the catalog stays the single owner of rules text.

**Prune bounded logs in the write.** Inserting a roll or an undo entry prunes in the
same statement — 200 and 50 rows per character respectively.

## Checking it

```bash
pnpm dev
curl -s http://127.0.0.1:8787/openapi.json | jq '.paths | keys'
```

Import that URL into Bruno or Postman rather than hand-writing requests.
