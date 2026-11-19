import { sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { computeAnonId } from "./crypto";
import { verifyPassword } from "./password";

export type AppRole = "STUDENT" | "ADMIN" | "AUTHORITY" | "SUPER_ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  collegeId: string | null;
  image: string | null;
};

type CollegeAccount = {
  login: string;
  email: string;
  name?: string;
  role?: AppRole;
  passwordHash: string;
};

const ROLES: AppRole[] = ["STUDENT", "ADMIN", "AUTHORITY", "SUPER_ADMIN"];

function normaliseRole(role: unknown): AppRole {
  return typeof role === "string" && (ROLES as string[]).includes(role) ? (role as AppRole) : "STUDENT";
}

/**
 * College accounts that live outside the database.
 *
 * Useful for a fresh deployment / college lab machine where PostgreSQL is not
 * provisioned yet: set COLLEGE_ACCOUNTS to a JSON array of
 *   { "login", "email", "name", "role", "passwordHash" }
 * where passwordHash is produced by hashPassword() in src/lib/password.ts.
 *
 * Accounts in the database always take priority over these.
 */
let cachedAccounts: CollegeAccount[] | null = null;

export function getCollegeAccounts(): CollegeAccount[] {
  if (cachedAccounts) return cachedAccounts;

  const raw = process.env.COLLEGE_ACCOUNTS;
  if (!raw) return (cachedAccounts = []);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return (cachedAccounts = []);

    cachedAccounts = parsed
      .filter((a) => a && typeof a.login === "string" && typeof a.passwordHash === "string")
      .map((a) => ({
        login: a.login,
        email: typeof a.email === "string" ? a.email : `${a.login}@presidencyuniversity.edu`,
        name: typeof a.name === "string" ? a.name : a.login,
        role: normaliseRole(a.role),
        passwordHash: a.passwordHash,
      }));

    return cachedAccounts;
  } catch (error) {
    console.error("[auth] COLLEGE_ACCOUNTS is not valid JSON:", (error as Error).message);
    return (cachedAccounts = []);
  }
}

/** Runs a database query but never lets an unavailable database break sign-in. */
async function withDb<T>(operation: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    return await operation();
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause?.message;
    console.warn(
      "[auth] database unavailable, continuing without it:",
      cause ?? (error as Error).message.split("\n")[0],
    );
    return null;
  }
}

export function findEnvAccountByEmail(email: string): CollegeAccount | undefined {
  const needle = email.trim().toLowerCase();
  return getCollegeAccounts().find((account) => account.email.toLowerCase() === needle);
}

/**
 * Verifies a college login id (or college email) plus password.
 * Checks the database first, then COLLEGE_ACCOUNTS.
 */
export async function verifyCollegeCredentials(login: string, password: string): Promise<AuthUser | null> {
  const needle = login.trim().toLowerCase();
  if (!needle || !password) return null;

  const row = await withDb(async () => {
    const result = await db.execute(sql`
      select id, email, name, role, college_id as "collegeId", image, password_hash as "passwordHash"
        from users
       where lower(coalesce(college_id, '')) = ${needle} or lower(email) = ${needle}
       limit 1
    `);

    const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
    return rows[0] ?? null;
  });

  if (row && typeof row.passwordHash === "string" && verifyPassword(password, row.passwordHash)) {
    return {
      id: String(row.id),
      email: String(row.email),
      name: (row.name as string) ?? null,
      role: normaliseRole(row.role),
      collegeId: (row.collegeId as string) ?? null,
      image: (row.image as string) ?? null,
    };
  }

  const account = getCollegeAccounts().find(
    (candidate) => candidate.login.toLowerCase() === needle || candidate.email.toLowerCase() === needle,
  );

  if (account && verifyPassword(password, account.passwordHash)) {
    return {
      id: `college:${account.login}`,
      email: account.email,
      name: account.name ?? account.login,
      role: normaliseRole(account.role),
      collegeId: account.login,
      image: null,
    };
  }

  return null;
}

/**
 * Creates/updates the local profile after a Google or Microsoft sign-in.
 * Returns null when no database is configured — sign-in still succeeds.
 */
export async function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<AuthUser | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  return withDb(async () => {
    const [row] = await db
      .insert(users)
      .values({
        email,
        name: input.name ?? null,
        image: input.image ?? null,
        role: "STUDENT",
        anonId: computeAnonId(email),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: input.name ?? null,
          image: input.image ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: normaliseRole(row.role),
      collegeId: row.collegeId,
      image: row.image,
    };
  });
}
