import { NextResponse } from "next/server";
import { runMigrations } from "@/db/migrate";
import { STATE, readState, type DigestCard } from "@/lib/digest";

export const dynamic = "force-dynamic";

/**
 * Reads the day's cards straight out of live_state. Deliberately does no feed
 * fetching and makes no AI call — opening Aperture must never cost anything.
 */
export async function GET() {
  try {
    await runMigrations();
    const stored = await readState<{
      date?: string;
      generatedAt?: string;
      cards?: DigestCard[];
    } | null>(STATE.cards, null);

    return NextResponse.json({
      cards: stored?.cards || [],
      generatedAt: stored?.generatedAt || null,
    });
  } catch (error) {
    console.error("Digest read error:", error);
    return NextResponse.json({ cards: [], generatedAt: null });
  }
}
