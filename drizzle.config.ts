import { defineConfig } from "drizzle-kit";
import { dbPath } from "./src/lib/db/path";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: dbPath() },
});
