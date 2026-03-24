import { NextResponse } from "next/server";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";

export const dynamic = "force-dynamic";

// GET /api/state — returns all keys, or a specific key via ?key=
export async function GET(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const row = await db.execute({ sql: "SELECT value FROM live_state WHERE key = ?", args: [key] });
      return NextResponse.json({ value: row.rows[0]?.value ?? null });
    }

    const rows = await db.execute("SELECT key, value FROM live_state");
    const state: Record<string, string | null> = {};
    for (const row of rows.rows) {
      state[row.key as string] = row.value as string;
    }
    return NextResponse.json(state);
  } catch (error) {
    console.error("State GET error:", error);
    return NextResponse.json({ error: "Failed to read state" }, { status: 500 });
  }
}

// PUT /api/state — upsert a key: { key, value }
export async function PUT(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO live_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [key, value],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("State PUT error:", error);
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }
}

// DELETE /api/state?key= — remove a key
export async function DELETE(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    await db.execute({ sql: "DELETE FROM live_state WHERE key = ?", args: [key] });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("State DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete state" }, { status: 500 });
  }
}
