import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/homebrew.ts",
  out: "./drizzle/homebrew",
  dbCredentials: { url: "../../data/homebrew.db" },
});
