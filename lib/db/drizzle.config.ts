import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl = process.env.KEYTOPIA_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("KEYTOPIA_DATABASE_URL must be set to the canonical Neon connection string.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
