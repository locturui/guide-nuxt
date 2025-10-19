#!/usr/bin/env node
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-disable-next-line node/no-process-env
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set");
  console.error("Please set it in your .env file or environment");
  process.exit(1);
}

async function initDatabase() {
  // eslint-disable-next-line no-console
  console.log("Connecting to database...");

  const sql = postgres(DATABASE_URL as string);

  try {
    const sqlFile = join(__dirname, "..", "server", "db", "init.sql");
    const schema = await readFile(sqlFile, "utf-8");

    // eslint-disable-next-line no-console
    console.log("📝 Running database initialization script...");
    await sql.unsafe(schema);

    // eslint-disable-next-line no-console
    console.log("Database initialized successfully!");
    // eslint-disable-next-line no-console
    console.log("\nDefault credentials:");
    // eslint-disable-next-line no-console
    console.log("  Admin: admin@example.com / admin123");
    // eslint-disable-next-line no-console
    console.log("  Agency: agency@example.com / agency123");
    // eslint-disable-next-line no-console
    console.log("\nPlease change these passwords in production!");
  }
  catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
  finally {
    await sql.end();
  }
}

initDatabase();
