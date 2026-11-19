import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __amsPool?: Pool };

/**
 * A single pooled connection per server process.
 * connectionTimeoutMillis keeps sign-in fast when a local database is down.
 */
const pool =
  globalForDb.__amsPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 4000,
    idleTimeoutMillis: 30000,
  });

pool.on("error", (error) => {
  console.warn("[db] idle client error:", error.message);
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__amsPool = pool;
}

export const db = drizzle(pool, { schema });
