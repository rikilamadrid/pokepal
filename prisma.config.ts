import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7's CLI no longer auto-loads dotenv files. Load `.env` ourselves using
// Node's built-in loader (no extra dependency) so DATABASE_URL / DIRECT_URL are
// available to the migration engine below.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env is optional — the app runs fully local-only when unconfigured.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct connection (port 5432) for schema migrations. The pooled URL is only
    // needed by a Prisma runtime client, which this app does not use.
    url: process.env.DIRECT_URL,
  },
});
