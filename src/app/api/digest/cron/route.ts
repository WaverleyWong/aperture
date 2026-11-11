import { NextResponse } from "next/server";
import { generateDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
// Feed fetching plus a Sonnet call needs more than the default budget.
export const maxDuration = 300;

/**
 * Daily cron entry point — 05:00 UTC, see vercel.json.
 *
 * This path is exempt from the passcode gate because Vercel's scheduler can't
 * carry a session cookie. It is not open: Vercel sends `Authorization: Bearer
 * $CRON_SECRET` automatically, and with CRON_SECRET unset this refuses
 * everything rather than falling open.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Digest cron called but CRON_SECRET is not set.");
    return NextResponse.json(
      { error: "Cron is not configured." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const result = await generateDigest();
    return NextResponse.json(
      {
        ok: true,
        cards: result.cards.length,
        candidates: result.candidateCount,
        profileRewritten: result.profileRewritten,
        generatedAt: result.generatedAt,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Digest cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
