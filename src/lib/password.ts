import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing for college (AMS) accounts.
 *
 * Format: scrypt:<saltHex>:<hashHex>
 * scrypt is built into Node, so no native dependency is required in production.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!password || !stored) return false;

  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, hash] = parts;
  if (!/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]+$/i.test(hash)) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length || 64);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
