// Single-user passcode gate.
//
// Everything here uses Web Crypto (`crypto.subtle`) rather than `node:crypto`,
// because this module is imported by both `src/proxy.ts` — which Next runs in
// the edge-style runtime — and by the Node route handler at /api/login.
//
// No passcode or secret is ever stored in this file. Both come from the
// environment, and a missing value makes every caller refuse the request.

/** Name of the session cookie. */
export const SESSION_COOKIE = "aperture_session";

/** Cookie lifetime: one year. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Re-issue the cookie once the current token is older than this (24h). Any day
 * the app gets used, the year-long window starts again — so a device in regular
 * use is never logged out, without writing Set-Cookie on every single request.
 */
export const SESSION_RENEW_AFTER = 60 * 60 * 24;

const TOKEN_VERSION = "v1";

const encoder = new TextEncoder();

export interface AuthConfig {
  passcode: string;
  secret: string;
}

/**
 * Reads the two required environment variables.
 *
 * Returns null when either is missing or blank. Callers MUST treat null as
 * "refuse this request" — never as "let it through".
 */
export function getAuthConfig(): AuthConfig | null {
  const passcode = process.env.APERTURE_PASSCODE;
  const secret = process.env.APERTURE_SESSION_SECRET;
  if (!passcode || !passcode.trim()) return null;
  if (!secret || !secret.trim()) return null;
  return { passcode, secret };
}

/**
 * Compares two equal-length byte arrays without an early exit, so the time
 * taken doesn't depend on where the first difference is.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Constant-time passcode check.
 *
 * Both sides are hashed first so the comparison is always over 32 bytes —
 * neither the length nor the content of the attempt affects how long it takes.
 */
export async function passcodeMatches(attempt: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(attempt), sha256(expected)]);
  return timingSafeEqual(a, b);
}

/** Builds a token of the form `v1.<issuedAtMs>.<hmac>`. */
export async function createSessionToken(secret: string, issuedAt = Date.now()): Promise<string> {
  const payload = `${TOKEN_VERSION}.${issuedAt}`;
  return `${payload}.${toBase64Url(await hmacSha256(secret, payload))}`;
}

export interface SessionState {
  valid: boolean;
  /** Epoch ms the token was issued; 0 when invalid. */
  issuedAt: number;
}

const INVALID_SESSION: SessionState = { valid: false, issuedAt: 0 };

/** Verifies a token's signature and age. */
export async function readSessionToken(
  token: string | undefined,
  secret: string
): Promise<SessionState> {
  if (!token) return INVALID_SESSION;

  const parts = token.split(".");
  if (parts.length !== 3) return INVALID_SESSION;

  const [version, issuedAtRaw, signature] = parts;
  if (version !== TOKEN_VERSION) return INVALID_SESSION;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return INVALID_SESSION;

  const expected = toBase64Url(await hmacSha256(secret, `${version}.${issuedAtRaw}`));
  if (!timingSafeEqual(encoder.encode(signature), encoder.encode(expected))) {
    return INVALID_SESSION;
  }

  if (ageInSeconds(issuedAt) > SESSION_MAX_AGE) return INVALID_SESSION;

  return { valid: true, issuedAt };
}

/** Age of a token in seconds. Negative values (clock skew) count as fresh. */
export function ageInSeconds(issuedAt: number): number {
  return Math.max(0, (Date.now() - issuedAt) / 1000);
}

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

/**
 * Cookie attributes. Always set from a server response rather than from
 * JavaScript: Safari caps script-written cookies at 7 days.
 */
export function sessionCookie(token: string): SessionCookie {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
