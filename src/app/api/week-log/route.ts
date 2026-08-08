import { NextResponse } from "next/server";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";
import { getTodayLondonISO, getWeekStartISO } from "@/lib/week";

export const dynamic = "force-dynamic";

// Monday of the week containing entry_date. SQLite's %w is 0 = Sunday.
const WEEK_START_SQL =
  "date(entry_date, '-' || ((strftime('%w', entry_date) + 6) % 7) || ' days')";

const SELECT_COLUMNS =
  "id, entry_date, title, notion_page_id, timebox_task_id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(row: any) {
  return {
    id: row.id as number,
    entryDate: row.entry_date as string,
    title: row.title as string,
    notionPageId: (row.notion_page_id as string | null) ?? undefined,
    timeboxTaskId: (row.timebox_task_id as string | null) ?? undefined,
  };
}

// GET /api/week-log
//   ?date=YYYY-MM-DD  → entries for that single day (drives the timebox toggle)
//   ?week=YYYY-MM-DD  → entries for the week containing that date
//   (no params)       → the week containing max(entry_date), else the current week
export async function GET(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const week = searchParams.get("week");

    if (date) {
      const rows = await db.execute({
        sql: `SELECT ${SELECT_COLUMNS} FROM week_log WHERE entry_date = ? ORDER BY id`,
        args: [date],
      });
      return NextResponse.json({ entries: rows.rows.map(toEntry) });
    }

    let weekStart: string;
    if (week) {
      weekStart = getWeekStartISO(week);
    } else {
      // Default week: the one holding the most recent entry, so at 9am Monday
      // this opens on last week. Falls back to the current week when empty.
      const latest = await db.execute(
        `SELECT ${WEEK_START_SQL} AS week_start FROM week_log ORDER BY entry_date DESC LIMIT 1`
      );
      weekStart =
        (latest.rows[0]?.week_start as string | undefined) ??
        getWeekStartISO(getTodayLondonISO());
    }

    const rows = await db.execute({
      sql: `SELECT ${SELECT_COLUMNS} FROM week_log
            WHERE entry_date >= ? AND entry_date < date(?, '+7 days')
            ORDER BY entry_date, id`,
      args: [weekStart, weekStart],
    });

    return NextResponse.json({ weekStart, entries: rows.rows.map(toEntry) });
  } catch (error) {
    console.error("Week log GET error:", error);
    return NextResponse.json({ error: "Failed to read week log" }, { status: 500 });
  }
}

// POST /api/week-log — log a task: { entryDate, title, notionPageId?, timeboxTaskId }
// Idempotent: a repeat tap hits the unique index and is ignored rather than erroring.
export async function POST(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const { entryDate, title, notionPageId, timeboxTaskId } = await request.json();

    if (!entryDate || !title) {
      return NextResponse.json({ error: "Missing entryDate or title" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO week_log (entry_date, title, notion_page_id, timebox_task_id)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (timebox_task_id, entry_date) DO NOTHING`,
      args: [entryDate, title, notionPageId ?? null, timeboxTaskId ?? null],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Week log POST error:", error);
    return NextResponse.json({ error: "Failed to log task" }, { status: 500 });
  }
}

// DELETE /api/week-log
//   ?id=                            → remove one entry (inline delete on /week)
//   ?timeboxTaskId=&entryDate=      → untoggle from the timebox
export async function DELETE(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const timeboxTaskId = searchParams.get("timeboxTaskId");
    const entryDate = searchParams.get("entryDate");

    if (id) {
      await db.execute({ sql: "DELETE FROM week_log WHERE id = ?", args: [id] });
    } else if (timeboxTaskId && entryDate) {
      await db.execute({
        sql: "DELETE FROM week_log WHERE timebox_task_id = ? AND entry_date = ?",
        args: [timeboxTaskId, entryDate],
      });
    } else {
      return NextResponse.json(
        { error: "Missing id, or timeboxTaskId and entryDate" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Week log DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
