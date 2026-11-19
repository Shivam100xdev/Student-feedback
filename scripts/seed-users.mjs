#!/usr/bin/env node
/**
 * Seeds demo AMS accounts into PostgreSQL so college logins work from the database.
 * Usage: npm run db:seed
 *
 * Existing rows are updated in place (safe to run repeatedly).
 */
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv(file = ".env.local") {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // .env.local is optional when the variables are exported already
  }
}

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

const anonId = (email) =>
  createHmac("sha256", process.env.SERVER_SECRET || "dev-secret-change-in-production")
    .update(email)
    .digest("hex");

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const accounts = [
  {
    login: "20231ST0024",
    email: "20231st0024@presidencyuniversity.edu",
    name: "Aarav Sharma",
    role: "STUDENT",
    password: process.env.SEED_STUDENT_PASSWORD || "Student@2026",
  },
  {
    login: "AMS-ADMIN",
    email: "ams.admin@presidencyuniversity.edu",
    name: "AMS Administrator",
    role: "ADMIN",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin@2026",
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  for (const account of accounts) {
    await client.query(
      `insert into users (email, name, role, college_id, anon_id, password_hash)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (email) do update
         set name = excluded.name,
             role = excluded.role,
             college_id = excluded.college_id,
             password_hash = excluded.password_hash,
             updated_at = now()`,
      [account.email, account.name, account.role, account.login, anonId(account.email), hashPassword(account.password)],
    );
    console.log(`✓ ${account.login} (${account.role}) ready`);
  }
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
