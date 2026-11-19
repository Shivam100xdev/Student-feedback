#!/usr/bin/env node
/**
 * Generates a COLLEGE_ACCOUNTS password hash.
 * Usage: npm run auth:hash-password -- "YourPassword"
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run auth:hash-password -- "YourPassword"');
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt:${salt}:${hash}`);
