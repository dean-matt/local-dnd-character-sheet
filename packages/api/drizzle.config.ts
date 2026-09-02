import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/characters.ts",
  out: "./drizzle/characters",
  dbCredentials: { url: "../../data/characters.db" },
});
