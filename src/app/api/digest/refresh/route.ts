import { NextResponse } from "next/server";
import { generateDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual "refresh now", for testing on previews where cron never runs.
 *
 * Sits behind the normal passcode gate, so it needs no secret of its own.
 * Each call is one Claude request.
 */
export async function POST() {
  try {
    const result = await generateDigest();
    return NextResponse.json(
      {
        ok: true,
        cards: result.cards,
        generatedAt: result.generatedAt,
        candidateCount: result.candidateCount,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("Digest refresh failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
