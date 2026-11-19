import { createHmac, createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SERVER_SECRET = process.env.SERVER_SECRET || "dev-secret-change-in-production";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dev-encryption-key-32-chars!!"; // 32 chars for AES-256

/**
 * Compute anon_id = HMAC_SHA256(user_id, SERVER_SECRET)
 * This ensures the link between user and feedback is one-way and cannot be reversed.
 */
export function computeAnonId(userId: string): string {
  return createHmac("sha256", SERVER_SECRET).update(userId).digest("hex");
}

/**
 * Verify if an anon_id matches a user_id
 */
export function verifyAnonId(userId: string, anonId: string): boolean {
  const expected = computeAnonId(userId);
  return expected === anonId;
}

/**
 * Generate a secure tracking code for feedback
 */
export function generateTrackingCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `TRK-${timestamp}-${random}`;
}

/**
 * Generate a ticket code for display
 */
export function generateTicketCode(): string {
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `FEED-${random}`;
}

/**
 * Encrypt sensitive content using AES-256-GCM
 * Returns { encrypted, iv, authTag }
 */
export function encryptContent(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const key = scryptSync(ENCRYPTION_KEY, "salt", 32); // Derive 32-byte key
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt sensitive content
 */
export function decryptContent(encrypted: string, iv: string, authTag: string): string {
  const key = scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Hash an IP address or device fingerprint for rate limiting
 */
export function hashIdentifier(identifier: string): string {
  return createHmac("sha256", SERVER_SECRET).update(identifier).digest("hex").substring(0, 32);
}

/**
 * Redact PII from text before sending to AI or storing
 */
export function redactPii(text: string): { redacted: string; wasRedacted: boolean } {
  let redacted = text;
  let wasRedacted = false;

  // Email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(redacted)) {
    redacted = redacted.replace(emailRegex, "[EMAIL REDACTED]");
    wasRedacted = true;
  }

  // Phone regex (Indian format)
  const phoneRegex = /(\+91[\-\s]?)?[0-9]{10}/g;
  if (phoneRegex.test(redacted)) {
    redacted = redacted.replace(phoneRegex, "[PHONE REDACTED]");
    wasRedacted = true;
  }

  // Roll number / Student ID (common college format)
  const idRegex = /[0-9]{2}[A-Za-z]{3}[0-9]{3,4}/g;
  if (idRegex.test(redacted)) {
    redacted = redacted.replace(idRegex, "[ID REDACTED]");
    wasRedacted = true;
  }

  // Aadhaar-like numbers (12 digits)
  const aadhaarRegex = /\b[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\b/g;
  if (aadhaarRegex.test(redacted)) {
    redacted = redacted.replace(aadhaarRegex, "[AADHAAR REDACTED]");
    wasRedacted = true;
  }

  return { redacted, wasRedacted };
}

/**
 * Generate device fingerprint hash from request headers
 */
export function generateDeviceFingerprint(headers: Headers): string {
  const userAgent = headers.get("user-agent") || "";
  const acceptLanguage = headers.get("accept-language") || "";
  const acceptEncoding = headers.get("accept-encoding") || "";

  const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  return createHmac("sha256", SERVER_SECRET).update(fingerprint).digest("hex").substring(0, 32);
}