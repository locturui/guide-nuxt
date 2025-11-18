import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function useDB() {
  if (db) {
    return db;
  }

  // eslint-disable-next-line node/no-process-env
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  client = postgres(databaseUrl, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 30,
    prepare: false,
    max_lifetime: 60 * 30,
    connection: {
      application_name: "guide-nuxt",
    },
    transform: {
      undefined: null,
    },
    onnotice: () => {},
    onparameter: () => {},
  });
  db = drizzle(client, { schema });

  return db;
}

export function resetDB() {
  if (client) {
    try {
      client.end({ timeout: 5 });
    }
    catch {
    }
  }
  db = null;
  client = null;
}

export { schema };
