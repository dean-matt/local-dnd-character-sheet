import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { catalogSchemaWarning } from "./db/content.ts";
import { DATA_DIR } from "./db/singleton.ts";

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`api  http://127.0.0.1:${info.port}`);
  console.log(`spec http://127.0.0.1:${info.port}/openapi.json`);
  const warning = catalogSchemaWarning(DATA_DIR);
  if (warning) console.warn(warning);
});
