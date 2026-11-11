// Passcode gate for the whole app.
//
// `proxy.ts` is the request-interception convention in Next 16 — `middleware.ts`
// still works but logs "The "middleware" file convention is deprecated. Please
// use "proxy" instead."
//
// No matcher is exported, so this runs for every request. That is deliberate:
// if the passcode or session secret is missing, nothing at all gets served.

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_RENEW_AFTER,
  ageInSeconds,
  createSessionToken,
  getAuthConfig,
  readSessionToken,
  sessionCookie,
} from "@/lib/auth";

/** Exact paths that stay reachable without a session. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/login",
  "/manifest.json",
  "/sw.js",
  "/doodle.png",
  "/favicon.ico",
]);

/** Path prefixes that stay reachable without a session. */
const PUBLIC_PREFIXES = ["/icons/", "/sprites/", "/_next/"];

const NO_STORE = { "cache-control": "no-store" };

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Only same-origin paths are allowed as a post-login destination, so the
 * `?next=` parameter can't be used to bounce elsewhere. Rejects protocol-
 * relative (`//host`), backslash and control-character tricks.
 */
function isSafeInternalPath(target: string): boolean {
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  if (target.includes("\\")) return false;
  if (/[\x00-\x1f\x7f]/.test(target)) return false;
  return true;
}

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const auth = getAuthConfig();

  // Fail closed. A missing variable must never mean "allow".
  if (!auth) {
    const message = "Aperture is not configured: APERTURE_PASSCODE and APERTURE_SESSION_SECRET must both be set.";
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: message }, { status: 503, headers: NO_STORE });
    }
    return new NextResponse(message, {
      status: 503,
      headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (isPublic(pathname)) return NextResponse.next();

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, auth.secret);

  if (!session.valid) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const target = `${pathname}${search}`;
    if (target !== "/" && isSafeInternalPath(target)) {
      loginUrl.searchParams.set("next", target);
    }

    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("cache-control", "no-store");
    return redirect;
  }

  // Authenticated. Slide the expiry forward on a once-a-day basis so a device
  // in regular use never reaches the one-year limit.
  const response = NextResponse.next();
  if (ageInSeconds(session.issuedAt) > SESSION_RENEW_AFTER) {
    response.cookies.set(sessionCookie(await createSessionToken(auth.secret)));
  }
  return response;
}
