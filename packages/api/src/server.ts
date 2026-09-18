import { serve } from "@hono/node-server";
import { app } from "./app.ts";
// Opens characters.db and homebrew.db and migrates each, before anything can query them.
import "./db/client.ts";

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`api  http://127.0.0.1:${info.port}`);
  console.log(`spec http://127.0.0.1:${info.port}/openapi.json`);
});
