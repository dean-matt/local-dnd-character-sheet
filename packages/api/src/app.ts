import { OpenAPIHono } from "@hono/zod-openapi";
import { charactersDb, DATA_DIR, homebrewDb } from "./db/singleton.ts";
import { backgroundsRoutes } from "./routes/backgrounds.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { charactersRoutes } from "./routes/characters.ts";
import { classesRoutes } from "./routes/classes.ts";
import { featsRoutes } from "./routes/feats.ts";
import { healthRoutes } from "./routes/health.ts";
import { homebrewRoutes } from "./routes/homebrew.ts";
import { itemsRoutes } from "./routes/items.ts";
import { racesRoutes } from "./routes/races.ts";
import { searchRoutes } from "./routes/search.ts";
import { spellsRoutes } from "./routes/spells.ts";

export const app = new OpenAPIHono();

app.route("/", charactersRoutes(charactersDb));
app.route("/", homebrewRoutes(homebrewDb, charactersDb));
app.route("/", spellsRoutes(DATA_DIR, homebrewDb));
app.route("/", itemsRoutes(DATA_DIR, homebrewDb));
app.route("/", racesRoutes(DATA_DIR));
app.route("/", backgroundsRoutes(DATA_DIR));
app.route("/", featsRoutes(DATA_DIR));
app.route("/", classesRoutes(DATA_DIR));
app.route("/", searchRoutes(DATA_DIR, homebrewDb));
app.route("/", catalogRoutes(DATA_DIR));
app.route("/", healthRoutes(DATA_DIR));

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "local-dnd-character-sheet", version: "0.0.0" },
});
