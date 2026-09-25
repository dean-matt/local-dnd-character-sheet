import { OpenAPIHono } from "@hono/zod-openapi";
import { charactersDb, DATA_DIR, homebrewDb } from "./db/singleton.ts";
import { backgroundsRoutes } from "./routes/backgrounds.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { characterInventoryRoutes } from "./routes/character-inventory.ts";
import { characterSpellsRoutes } from "./routes/character-spells.ts";
import { charactersRoutes } from "./routes/characters.ts";
import { classesRoutes } from "./routes/classes.ts";
import { derivedRoutes } from "./routes/derived.ts";
import { featsRoutes } from "./routes/feats.ts";
import { featuresRoutes } from "./routes/features.ts";
import { healthRoutes } from "./routes/health.ts";
import { homebrewRoutes } from "./routes/homebrew.ts";
import { itemsRoutes } from "./routes/items.ts";
import { pagesRoutes } from "./routes/pages.ts";
import { racesRoutes } from "./routes/races.ts";
import { refsRoutes } from "./routes/refs.ts";
import { searchRoutes } from "./routes/search.ts";
import { spellsRoutes } from "./routes/spells.ts";

export const app = new OpenAPIHono();

app.route("/", charactersRoutes(charactersDb));
app.route("/", pagesRoutes(charactersDb));
app.route("/", derivedRoutes(charactersDb, DATA_DIR, homebrewDb));
app.route("/", featuresRoutes(charactersDb, DATA_DIR, homebrewDb));
app.route("/", characterSpellsRoutes(charactersDb, DATA_DIR, homebrewDb));
app.route("/", characterInventoryRoutes(charactersDb, DATA_DIR, homebrewDb));
app.route("/", homebrewRoutes(homebrewDb, charactersDb));
app.route("/", spellsRoutes(DATA_DIR, homebrewDb));
app.route("/", itemsRoutes(DATA_DIR, homebrewDb));
app.route("/", racesRoutes(DATA_DIR));
app.route("/", backgroundsRoutes(DATA_DIR));
app.route("/", featsRoutes(DATA_DIR));
app.route("/", classesRoutes(DATA_DIR));
app.route("/", searchRoutes(DATA_DIR, homebrewDb));
app.route("/", catalogRoutes(DATA_DIR));
app.route("/", refsRoutes(DATA_DIR, homebrewDb));
app.route("/", healthRoutes(DATA_DIR));

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "local-dnd-character-sheet", version: "0.0.0" },
});
