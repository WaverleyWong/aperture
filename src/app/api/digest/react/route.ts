import { NextResponse } from "next/server";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";
import { getTodayLondonISO } from "@/lib/week";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["more", "less", "open"]);

/**
 * Records a reaction to a card. "open" is the weak positive sent when a card
 * is clicked; ignoring a card sends nothing at all.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, headline, source, topic, reaction } = body || {};

    if (!url || !headline || !source || !ALLOWED.has(reaction)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    await runMigrations();
    await getDb().execute({
      sql: `INSERT INTO digest_reactions (card_url, headline, source, topic, reaction, entry_date)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [url, headline, source, topic || null, reaction, getTodayLondonISO()],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Digest reaction error:", error);
    return NextResponse.json({ error: "Failed to record reaction" }, { status: 500 });
  }
}
