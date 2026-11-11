import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAuthConfig,
  passcodeMatches,
  sessionCookie,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Fixed pause after a wrong passcode, to slow down repeated guessing. */
const WRONG_ATTEMPT_DELAY_MS = 700;

const NO_STORE = { "cache-control": "no-store" };

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const auth = getAuthConfig();

  // Fail closed, exactly as the proxy does.
  if (!auth) {
    return NextResponse.json(
      { error: "Aperture is not configured." },
      { status: 503, headers: NO_STORE }
    );
  }

  let attempt = "";
  try {
    const body = await request.json();
    if (body && typeof body.passcode === "string") attempt = body.passcode;
  } catch {
    // Unparseable body counts as a wrong attempt.
  }

  if (!(await passcodeMatches(attempt, auth.passcode))) {
    await pause(WRONG_ATTEMPT_DELAY_MS);
    return NextResponse.json(
      { error: "Incorrect passcode." },
      { status: 401, headers: NO_STORE }
    );
  }

  // Set from the server response, not from JavaScript — Safari limits
  // script-written cookies to 7 days.
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set(sessionCookie(await createSessionToken(auth.secret)));
  return response;
}
