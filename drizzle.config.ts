import type { Config } from "drizzle-kit";
import { existsSync } from "node:fs";

// drizzle-kit khong tu nap .env.local. Bien da co san trong moi truong luon thang,
// de e2e tro drizzle-kit toi database rieng ma khong bi file ghi de.
if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

export default {
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
